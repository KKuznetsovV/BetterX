import type { Request, Response, NextFunction } from 'express'
import User from '../../models/User'
import { updateUserInSeed, removeUserFromSeed } from '../../db/seed-updater'
import config from 'config'
import { createHmac } from 'crypto'
import { sign } from 'jsonwebtoken'
import SocketMessages from 'socket-enums-kkuznetsovv-123'
import socket from '../../io/io'
import { validateImageSource } from '../../middlewares/file-uploader'

function hashPassword(plainTextPassword: string) {
    const encryptionKey = config.get<string>('app.encryptionKey');
    return createHmac('sha256', encryptionKey).update(plainTextPassword).digest('hex');
}


export async function updateProfile(
    request: Request<{}, {}, { name?: string; username?: string; password?: string; avatarUrl?: string | null }>,
    response: Response,
    next: NextFunction
) {
    try {
        const { userId } = request
        const user = await User.findByPk(userId)
        if (!user) return next({ status: 404, message: 'user not found' })

        if (request.body.name) user.name = request.body.name
        if (request.body.username) user.username = request.body.username
        if (request.body.password) user.password = hashPassword(request.body.password)
        if ('avatarUrl' in request.body) {
            const avatarUrl = request.body.avatarUrl || null
            if (avatarUrl) validateImageSource(avatarUrl)
            user.avatarUrl = avatarUrl
        }

        await user.save()
        await updateUserInSeed({ id: user.id, name: user.name, username: user.username, password: user.password, avatarUrl: user.avatarUrl })
        socket.emit(SocketMessages.NEW_PROFILE, { ...user.toJSON(), socketId: request.headers['x-socket-id'] })

        const jwt = sign(user.get({ plain: true }), config.get<string>('app.encryptionKey'))
        response.json({ jwt })
    } catch (e) {
        next(e)
    }
}

export async function deleteProfile(request: Request, response: Response, next: NextFunction) {
    try {
        const { userId } = request
        await User.destroy({ where: { id: userId } })
        await removeUserFromSeed(userId)
        response.json({ success: true })
    } catch (e) {
        next(e)
    }
}
