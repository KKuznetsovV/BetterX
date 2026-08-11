import type { Request, Response, NextFunction } from 'express'
import User from '../../models/User'
import Follow from '../../models/Follow'
import sequelize from '../../db/sequelize'
import { enqueueFollowCreatedEvent } from '../../notifications/notification-client'
import { appendFollowToSeed, removeFollowFromSeed } from '../../db/seed-updater'
import { followersIncludes, followingIncludes } from '../includes'
import socket from '../../io/io'
import SocketMessages from 'socket-enums-kkuznetsovv-123'

export async function getFollowers(request: Request, response: Response, next: NextFunction) {
    try {
        const { userId } = request

        const { followers } = await User.findByPk(userId, {
            include: followersIncludes
        })

        response.json(followers)
    } catch (e) {
        next(e)
    }
}

export async function getFollowersByUserId(request: Request<{ userId: string }>, response: Response, next: NextFunction) {
    try {
        const { userId } = request.params
        const user = await User.findByPk(userId, { include: followersIncludes })
        if (!user) return next({ status: 404, message: 'user not found' })
        response.json(user.followers)
    } catch (e) {
        next(e)
    }
}

export async function getFollowing(request: Request, response: Response, next: NextFunction) {
    try {
        const { userId } = request

        const { following } = await User.findByPk(userId, {
            include: followingIncludes
        })

        response.json(following)
    } catch (e) {
        next(e)
    }
}

export async function getFollowingByUserId(request: Request<{ userId: string }>, response: Response, next: NextFunction) {
    try {
        const { userId } = request.params
        const user = await User.findByPk(userId, { include: followingIncludes })
        if (!user) return next({ status: 404, message: 'user not found' })
        response.json(user.following)
    } catch (e) {
        next(e)
    }
}

export async function follow(request: Request<{ followeeId: string }>, response: Response, next: NextFunction) {
    try {
        const { userId } = request
        const { followeeId } = request.params

        const { newFollow, follower, followee } = await sequelize.transaction(async (transaction) => {
            const newFollow = await Follow.create({
                followerId: userId,
                followeeId
            }, { transaction })

            const follower = await User.findByPk(userId, { transaction })
            const followee = await User.findByPk(followeeId, { transaction })

            // Notify followee (skip self-follow). Enqueued in the same
            // transaction as the Follow write (outbox pattern).
            if (userId !== followeeId) {
                await enqueueFollowCreatedEvent(transaction, {
                    recipientId: followeeId,
                    actor: follower ? { id: follower.id, name: follower.name, username: follower.username, avatarUrl: follower.avatarUrl } : null,
                })
            }

            return { newFollow, follower, followee }
        })

        await appendFollowToSeed(userId, followeeId)
        response.json(newFollow)
        socket.emit(SocketMessages.NEW_FOLLOW, { follower, followee, socketId: request.headers['x-socket-id'] })
    } catch (e) {
        next(e)
    }
}

export async function unfollow(request: Request<{ followeeId: string }>, response: Response, next: NextFunction) {
    try {
        const { userId } = request
        const { followeeId } = request.params

        const rowCount = await Follow.destroy({
            where: {
                followerId: userId,
                followeeId
            }
        })

        if (rowCount === 0) return next({
            status: 404,
            message: 'you tried to delete a non existing followee'
        })

        await removeFollowFromSeed(userId, followeeId)
        response.json({ success: true })
    } catch (e) {
        next(e)
    }
}
