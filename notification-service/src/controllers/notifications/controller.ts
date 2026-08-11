import type { Request, Response, NextFunction } from 'express'
import Notification from '../../models/Notification'
import socket from '../../io/io'
import SocketMessages from 'socket-enums-kkuznetsovv-123'

interface ActorSnapshot {
    id: string
    name: string
    username: string
    avatarUrl: string | null
}

function toAppNotification(notif: Notification) {
    const plain = notif.get({ plain: true }) as Notification & {
        actorName: string | null
        actorUsername: string | null
        actorAvatarUrl: string | null
    }

    return {
        id: plain.id,
        recipientId: plain.recipientId,
        actorId: plain.actorId,
        type: plain.type,
        postId: plain.postId,
        commentId: plain.commentId,
        read: plain.read,
        createdAt: plain.createdAt,
        actor: plain.actorId
            ? { id: plain.actorId, name: plain.actorName, username: plain.actorUsername, avatarUrl: plain.actorAvatarUrl }
            : null,
    }
}

// Shared by the (legacy, still-authenticated) HTTP route below and by the
// RabbitMQ event consumer (see src/mq/consumer.ts) - both just need to
// persist a Notification row and broadcast it over the realtime socket.
export async function persistAndBroadcastNotification(payload: {
    recipientId: string
    actorId?: string | null
    actor?: ActorSnapshot | null
    type: 'comment' | 'follow' | 'post'
    postId?: string | null
    commentId?: string | null
}) {
    const { recipientId, actorId, actor, type, postId, commentId } = payload

    const notif = await Notification.create({
        recipientId,
        actorId: actorId ?? actor?.id ?? null,
        actorName: actor?.name ?? null,
        actorUsername: actor?.username ?? null,
        actorAvatarUrl: actor?.avatarUrl ?? null,
        type,
        postId: postId ?? null,
        commentId: commentId ?? null,
    })

    const appNotification = toAppNotification(notif)
    socket.emit(SocketMessages.NEW_NOTIFICATION, appNotification)
    return appNotification
}

export async function getNotifications(request: Request, response: Response, next: NextFunction) {
    try {
        const { userId } = request
        const notifications = await Notification.findAll({
            where: { recipientId: userId },
            order: [['createdAt', 'DESC']],
            limit: 50,
        })
        response.json(notifications.map(toAppNotification))
    } catch (e) {
        next(e)
    }
}

export async function markAllRead(request: Request, response: Response, next: NextFunction) {
    try {
        const { userId } = request
        await Notification.update({ read: true }, { where: { recipientId: userId } })
        response.json({ success: true })
    } catch (e) {
        next(e)
    }
}

export async function markOneRead(request: Request<{ notificationId: string }>, response: Response, next: NextFunction) {
    try {
        const { userId } = request
        const { notificationId } = request.params
        const notif = await Notification.findByPk(notificationId)
        if (!notif || notif.recipientId !== userId) return next({ status: 404, message: 'notification not found' })
        notif.read = true
        await notif.save()
        response.json(toAppNotification(notif))
    } catch (e) {
        next(e)
    }
}
