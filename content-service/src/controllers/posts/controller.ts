import type { Request, Response, NextFunction } from 'express'
import Post, { POST_INCLUDE } from '../../models/Post'
import sequelize from '../../db/sequelize'
import socket from '../../io/io'
import SocketMessages from 'socket-enums-kkuznetsovv-123'
import { persistImage } from '../../media/media-client'
import { enqueuePostCreatedEvent } from '../../notifications/notification-client'
import { attachLikesToPosts } from '../../likes/likes-client'
import { attachUsersToPosts } from '../../identity/identity-client'
import { enqueuePostDeletedEvent, enqueuePostUpdatedEvent } from '../../recommendations/recommendation-client'
import { appendPostToSeed, updatePostInSeed } from '../../db/seed-updater'

export async function getAllPosts(request: Request, response: Response, next: NextFunction) {
    try {
        // Express 5's req.query is a non-cached getter that re-parses request.url on
        // every access, so the validate middleware's Joi-coerced numbers (attached via
        // Object.assign on a previous, now-discarded, req.query access) never survive to
        // here - values must be coerced again from the raw string query params directly.
        const rawLimit = Number(request.query.limit)
        const rawOffset = Number(request.query.offset)
        const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 10
        const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0
        const posts = await Post.findAll({ include: POST_INCLUDE, order: [['createdAt', 'DESC']], limit, offset })
        const plainPosts = posts.map(p => p.toJSON())
        const authHeader = request.get('Authorization')
        await attachUsersToPosts(plainPosts, authHeader)
        await attachLikesToPosts(plainPosts, authHeader)
        response.json(plainPosts)
    } catch (e) {
        next(e)
    }
}

export async function getMyPosts(request: Request, response: Response, next: NextFunction) {
    try {
        const { userId } = request
        const posts = await Post.findAll({ where: { userId }, include: POST_INCLUDE, order: [['createdAt', 'DESC']] })
        const plainPosts = posts.map(p => p.toJSON())
        const authHeader = request.get('Authorization')
        await attachUsersToPosts(plainPosts, authHeader)
        await attachLikesToPosts(plainPosts, authHeader)
        response.json(plainPosts)
    } catch (e) {
        next(e)
    }
}

export async function getUserPosts(request: Request<{ userId: string }>, response: Response, next: NextFunction) {
    try {
        const { userId } = request.params
        const posts = await Post.findAll({ where: { userId }, include: POST_INCLUDE, order: [['createdAt', 'DESC']] })
        const plainPosts = posts.map(p => p.toJSON())
        const authHeader = request.get('Authorization')
        await attachUsersToPosts(plainPosts, authHeader)
        await attachLikesToPosts(plainPosts, authHeader)
        response.json(plainPosts)
    } catch (e) {
        next(e)
    }
}

export async function getPost(request: Request<{ postId: string }>, response: Response, next: NextFunction) {
    try {
        const { postId } = request.params
        const post = await Post.findByPk(postId, { include: POST_INCLUDE })

        if (!post) return next({ status: 404, message: 'post does not exist' })

        const plainPost = post.toJSON()
        const authHeader = request.get('Authorization')
        await attachUsersToPosts([plainPost], authHeader)
        await attachLikesToPosts([plainPost], authHeader)

        response.json(plainPost)
    } catch (e) {
        next(e)
    }
}

export async function deletePost(request: Request<{ postId: string }>, response: Response, next: NextFunction) {
    try {
        const { postId } = request.params

        const deleted = await sequelize.transaction(async (transaction) => {
            const numberOfRowsDeleted = await Post.destroy({ where: { id: postId }, transaction })
            if (numberOfRowsDeleted === 0) return false
            await enqueuePostDeletedEvent(transaction, postId)
            return true
        })

        if (!deleted) {
            return next({
                status: 404,
                message: 'post you are trying to delete does not exist'
            })
        }
        response.json({ success: true })
        socket.emit(SocketMessages.DELETE_POST, { id: postId, socketId: request.headers['x-socket-id'] })
    } catch (e) {
        next(e)
    }
}

export async function createPost(request: Request<{}, {}, { title: string; body: string; imageUrl?: string }>, response: Response, next: NextFunction) {
    try {
        const { userId, actor } = request
        const authHeader = request.get('Authorization')
        const imageUrl = request.body.imageUrl
            ? await persistImage('post-image', request.body.imageUrl, authHeader)
            : undefined

        const newPost = await sequelize.transaction(async (transaction) => {
            const post = await Post.create({ title: request.body.title, body: request.body.body, userId, imageUrl }, { transaction })

            // Notify followers - notification-service's event consumer resolves
            // the follower list itself off this single event. This same event is
            // also bound by recommendation-service's own queue to build the
            // post's embedding, so the payload carries userId/title/body too.
            // Enqueued in the same transaction as the Post write (outbox pattern).
            await enqueuePostCreatedEvent(transaction, {
                postId: post.id,
                userId: post.userId,
                title: post.title,
                body: post.body,
                actor: actor ? { id: actor.id, name: actor.name, username: actor.username, avatarUrl: actor.avatarUrl ?? null } : null,
            })

            return post
        })

        await newPost.reload({ include: POST_INCLUDE })
        await appendPostToSeed({ id: newPost.id, userId: newPost.userId, title: newPost.title, body: newPost.body, imageUrl: newPost.imageUrl || '' })

        const plainPost = newPost.toJSON()
        await attachUsersToPosts([plainPost], authHeader)
        plainPost.likes = []
        for (const comment of plainPost.comments ?? []) comment.likes = []
        response.json(plainPost)
        socket.emit(SocketMessages.NEW_POST, { ...plainPost, socketId: request.headers['x-socket-id'] })
    } catch (e) {
        next(e)
    }
}

export async function updatePost(request: Request<{ postId: string }, {}, { title: string; body: string; imageUrl?: string | null }>, response: Response, next: NextFunction) {
    try {
        const { postId } = request.params
        const { title, body, imageUrl: bodyImageUrl } = request.body
        const authHeader = request.get('Authorization')

        // Resolved up-front (it's an HTTP call to media-service) so the DB
        // transaction below stays short-lived and never holds a connection
        // open across a network round-trip.
        const nextImageUrl = 'imageUrl' in request.body
            ? (bodyImageUrl ? await persistImage('post-image', bodyImageUrl, authHeader) : null)
            : undefined

        const updatedPost = await sequelize.transaction(async (transaction) => {
            const post = await Post.findByPk(postId, { include: POST_INCLUDE, transaction })
            if (!post) return null

            post.title = title
            post.body = body
            if (nextImageUrl !== undefined) post.imageUrl = nextImageUrl
            await post.save({ transaction })
            await enqueuePostUpdatedEvent(transaction, { id: post.id, userId: post.userId, title: post.title, body: post.body })

            return post
        })

        if (!updatedPost) return next({ status: 404, message: 'post does not exist' })

        await updatePostInSeed({ id: updatedPost.id, userId: updatedPost.userId, title: updatedPost.title, body: updatedPost.body, imageUrl: updatedPost.imageUrl || '' })

        const plainPost = updatedPost.toJSON()
        await attachUsersToPosts([plainPost], authHeader)
        await attachLikesToPosts([plainPost], authHeader)
        response.json(plainPost)
        socket.emit(SocketMessages.UPDATE_POST, { ...plainPost, socketId: request.headers['x-socket-id'] })
    } catch (e) {
        next(e)
    }
}
