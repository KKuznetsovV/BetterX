import type { NextFunction, Request, Response } from 'express'
import Comment from '../../models/Comment'
import Post from '../../models/Post'
import sequelize from '../../db/sequelize'
import { enqueueCommentCreatedEvent } from '../../notifications/notification-client'
import { appendCommentToSeed, updateCommentInSeed } from '../../db/seed-updater'
import { attachUserToComment } from '../../identity/identity-client'
import socket from '../../io/io'
import SocketMessages from 'socket-enums-kkuznetsovv-123'

export async function createComment(request: Request<{ postId: string }, {}, { body: string; parentId?: string | null }>, response: Response, next: NextFunction) {
    try {
        const { userId, actor } = request
        const { postId } = request.params
        const { body, parentId } = request.body
        const authHeader = request.get('Authorization')

        const newComment = await sequelize.transaction(async (transaction) => {
            const comment = await Comment.create({
                body,
                postId,
                userId,
                parentId: parentId ?? null
            }, { transaction })

            // Notify post owner (skip if commenter is the owner). Enqueued in
            // the same transaction as the Comment write (outbox pattern).
            const post = await Post.findByPk(postId, { attributes: ['userId'], transaction })
            if (post && post.userId && post.userId !== userId) {
                await enqueueCommentCreatedEvent(transaction, {
                    recipientId: post.userId,
                    actor: actor ? { id: actor.id, name: actor.name, username: actor.username, avatarUrl: actor.avatarUrl ?? null } : null,
                    postId,
                    commentId: comment.id,
                })
            }

            return comment
        })

        await appendCommentToSeed({ id: newComment.id, postId: newComment.postId, userId: newComment.userId, body: newComment.body })

        const plainComment = { ...newComment.toJSON(), likes: [] }
        await attachUserToComment(plainComment, authHeader)
        response.json(plainComment)
        socket.emit(SocketMessages.NEW_COMMENT, { ...plainComment, socketId: request.headers['x-socket-id'] })
    } catch (e) {
        next(e)
    }
}

export async function updateComment(request: Request<{ commentId: string }, {}, { body: string }>, response: Response, next: NextFunction) {
    try {
        const { userId } = request
        const { commentId } = request.params
        const { body } = request.body
        const authHeader = request.get('Authorization')

        const comment = await Comment.findByPk(commentId)
        if (!comment) return next({ status: 404, message: 'comment does not exist' })
        if (comment.userId !== userId) return next({ status: 403, message: 'you are not allowed to update this comment' })

        comment.body = body
        await comment.save()
        await updateCommentInSeed({ id: comment.id, postId: comment.postId, userId: comment.userId, body: comment.body })

        const plainComment = comment.toJSON()
        await attachUserToComment(plainComment, authHeader)
        response.json(plainComment)
        socket.emit(SocketMessages.UPDATE_COMMENT, { ...plainComment, socketId: request.headers['x-socket-id'] })
    } catch (e) {
        next(e)
    }
}

export async function deleteComment(request: Request<{ commentId: string }>, response: Response, next: NextFunction) {
    try {
        const { userId } = request
        const { commentId } = request.params

        const comment = await Comment.findByPk(commentId)
        if (!comment) return next({ status: 404, message: 'comment does not exist' })
        if (comment.userId !== userId) return next({ status: 403, message: 'you are not allowed to delete this comment' })

        const { postId } = comment
        await comment.destroy()
        response.json({ success: true })
        socket.emit(SocketMessages.DELETE_COMMENT, { id: commentId, postId, socketId: request.headers['x-socket-id'] })
    } catch (e) {
        next(e)
    }
}
