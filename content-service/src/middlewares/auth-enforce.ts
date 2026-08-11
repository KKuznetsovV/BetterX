import { NextFunction, Request, Response } from "express";
import { verify } from "jsonwebtoken";
import config from 'config'

interface DecodedUser {
    id: string
    name?: string
    username?: string
    avatarUrl?: string | null
}

declare global {
    namespace Express {
        interface Request {
            userId: string
            actor?: DecodedUser
        }
    }
}

export default function authEnforce(request: Request, response: Response, next: NextFunction) {
    const authHeader = request.get('Authorization')
    if (!authHeader) {
        return next({
            status: 401,
            message: 'you must be authenticated to access this resource'
        })
    }

    if (!authHeader.startsWith('Bearer ')) {
        return next({
            status: 401,
            message: 'invalid authentication header format'
        })
    }

    const [, jwt] = authHeader.split(' ')
    if (!jwt) return next({
        status: 401,
        message: 'i see auth header but cannot extract jwt from it'
    })

    const key = config.get<string>('app.encryptionKey')
    try {
        const decoded = verify(jwt, key) as DecodedUser
        request.userId = decoded.id
        request.actor = decoded
        next()
    } catch {
        return next({
            status: 401,
            message: 'invalid or expired token'
        })
    }
}
