import { Op } from 'sequelize'
import type { Request, Response, NextFunction } from 'express'
import Like from '../../models/Like'
import socket from '../../io/io'

export async function likePost(req: Request<{ postId: string }, {}, { emoji: string }>, res: Response, next: NextFunction) {
    try {
        const { userId } = req
        const { postId } = req.params
        const { emoji } = req.body
        const existing = await Like.findOne({ where: { userId, postId } })
        let like: Like
        if (existing) { existing.emoji = emoji; await existing.save(); like = existing }
        else { like = await Like.create({ userId, postId, commentId: null, emoji }) }
        res.json(like)
        socket.emit('NEW_LIKE', { like: like.toJSON(), socketId: req.headers['x-socket-id'] })
    } catch (e) { next(e) }
}

export async function unlikePost(req: Request<{ postId: string }>, res: Response, next: NextFunction) {
    try {
        const { userId } = req
        const { postId } = req.params
        const like = await Like.findOne({ where: { userId, postId } })
        if (like) { await like.destroy() }
        res.json({ success: true })
        socket.emit('REMOVE_LIKE', { userId, postId, socketId: req.headers['x-socket-id'] })
    } catch (e) { next(e) }
}

export async function likeComment(req: Request<{ commentId: string }, {}, { emoji: string }>, res: Response, next: NextFunction) {
    try {
        const { userId } = req
        const { commentId } = req.params
        const { emoji } = req.body
        const existingC = await Like.findOne({ where: { userId, commentId } })
        let like: Like
        if (existingC) { existingC.emoji = emoji; await existingC.save(); like = existingC }
        else { like = await Like.create({ userId, postId: null, commentId, emoji }) }
        res.json(like)
        socket.emit('NEW_LIKE', { like: like.toJSON(), socketId: req.headers['x-socket-id'] })
    } catch (e) { next(e) }
}

export async function unlikeComment(req: Request<{ commentId: string }>, res: Response, next: NextFunction) {
    try {
        const { userId } = req
        const { commentId } = req.params
        const likeC = await Like.findOne({ where: { userId, commentId } })
        if (likeC) { await likeC.destroy() }
        res.json({ success: true })
        socket.emit('REMOVE_LIKE', { userId, commentId, socketId: req.headers['x-socket-id'] })
    } catch (e) { next(e) }
}

// Used by other services (e.g. backend) to compose likes back onto posts/comments
// that now live in a different database. Comma-separated ids in query string.
export async function getLikesBatch(req: Request<{}, {}, {}, { postIds?: string; commentIds?: string }>, res: Response, next: NextFunction) {
    try {
        const postIds = (req.query.postIds ?? '').split(',').filter(Boolean)
        const commentIds = (req.query.commentIds ?? '').split(',').filter(Boolean)

        const likes = await Like.findAll({
            where: {
                [Op.or]: [
                    ...(postIds.length ? [{ postId: { [Op.in]: postIds } }] : []),
                    ...(commentIds.length ? [{ commentId: { [Op.in]: commentIds } }] : []),
                ],
            },
        })

        const byPostId: Record<string, Like[]> = {}
        const byCommentId: Record<string, Like[]> = {}

        for (const like of likes) {
            if (like.postId) {
                byPostId[like.postId] = byPostId[like.postId] ?? []
                byPostId[like.postId].push(like)
            }
            if (like.commentId) {
                byCommentId[like.commentId] = byCommentId[like.commentId] ?? []
                byCommentId[like.commentId].push(like)
            }
        }

        res.json({ byPostId, byCommentId })
    } catch (e) { next(e) }
}
