import type { Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import Post, { POST_INCLUDE } from '../../models/Post'
import { attachLikesToPosts } from '../../likes/likes-client'
import { attachUsersToPosts, fetchFollowingIds } from '../../identity/identity-client'

export async function getFeed(request: Request, response: Response, next: NextFunction) {
    try {
        const authHeader = request.get('Authorization')
        const followingIds = await fetchFollowingIds(authHeader)

        const posts = followingIds.length
            ? await Post.findAll({ where: { userId: { [Op.in]: followingIds } }, include: POST_INCLUDE, order: [['createdAt', 'DESC']] })
            : []

        const plainPosts = posts.map(p => p.toJSON())
        await attachUsersToPosts(plainPosts, authHeader)
        await attachLikesToPosts(plainPosts, authHeader)

        response.json(plainPosts)
    } catch (e) {
        next(e)
    }
}
