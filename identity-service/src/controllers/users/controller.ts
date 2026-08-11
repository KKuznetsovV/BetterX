import type { NextFunction, Request, Response } from 'express'
import User from '../../models/User'

export async function getUsers(request: Request, response: Response, next: NextFunction) {
    try {
        const users = await User.findAll({ attributes: { exclude: ['password'] } })
        response.json(users)
    } catch (e) {
        next(e)
    }
}
