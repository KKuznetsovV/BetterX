import { NextFunction, Request, Response } from 'express';
import config from 'config';
import { createHmac } from 'crypto';
import { sign } from 'jsonwebtoken';
import User from '../../models/User';
import { appendUserToSeed } from '../../db/seed-updater';

function hashPassword(plainTextPassword: string) {
    const encryptionKey = config.get<string>('app.encryptionKey');
    return createHmac('sha256', encryptionKey).update(plainTextPassword).digest('hex');
}

function issueJwt(user: { id: string; name: string; username: string; avatarUrl: string | null }) {
    // Only sign the non-sensitive fields needed by other services' auth middleware -
    // never include the password hash in the JWT payload, since JWTs are base64-encoded,
    // not encrypted, and this token is returned directly to the browser.
    return sign({ id: user.id, name: user.name, username: user.username, avatarUrl: user.avatarUrl }, config.get<string>('app.encryptionKey'));
}

export async function signup(request: Request<{}, {}, { username: string; password: string; name: string; avatarUrl?: string | null }>, response: Response, next: NextFunction) {
    try {
        const newUser = await User.create({
            ...request.body,
            password: hashPassword(request.body.password),
        });
        await appendUserToSeed({
            id: newUser.id,
            name: newUser.name,
            username: newUser.username,
            password: newUser.password,
            avatarUrl: newUser.avatarUrl,
        });
        const jwt = issueJwt(newUser);
        response.json({ jwt });
    } catch (e) {
        next(e);
    }
}

export async function login(request: Request<{}, {}, { username: string; password: string }>, response: Response, next: NextFunction) {
    try {
        const { username, password } = request.body;
        const user = await User.findOne({ where: { username, password: hashPassword(password) } });

        if (!user) {
            return next({
                status: 401,
                message: 'invalid username or password',
            });
        }
        const jwt = issueJwt(user);
        response.json({ jwt });
    } catch (e) {
        next(e);
    }
}
