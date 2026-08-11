import config from 'config'
import { sign } from 'jsonwebtoken'

export function getInternalServiceAuthHeader(): string {
    const token = sign({ id: 'system' }, config.get<string>('app.encryptionKey'))
    return `Bearer ${token}`
}

interface LikeSnapshot {
    id: string
    userId: string
    postId: string | null
    commentId: string | null
    emoji: string
    createdAt: string
    updatedAt: string
}

interface LikesBatchResponse {
    byPostId: Record<string, LikeSnapshot[]>
    byCommentId: Record<string, LikeSnapshot[]>
}

interface PlainCommentLike {
    id: string
    likes?: LikeSnapshot[]
    [key: string]: unknown
}

interface PlainPostLike {
    id: string
    likes?: LikeSnapshot[]
    comments?: PlainCommentLike[]
    [key: string]: unknown
}

async function fetchLikesBatch(postIds: string[], commentIds: string[], authHeader?: string): Promise<LikesBatchResponse> {
    if (postIds.length === 0 && commentIds.length === 0) {
        return { byPostId: {}, byCommentId: {} }
    }

    const engagementServiceUrl = config.get<string>('services.engagement.url')
    const params = new URLSearchParams()
    if (postIds.length) params.set('postIds', postIds.join(','))
    if (commentIds.length) params.set('commentIds', commentIds.join(','))

    const response = await fetch(`${engagementServiceUrl}/likes/batch?${params.toString()}`, {
        headers: { Authorization: authHeader ?? getInternalServiceAuthHeader() },
    })

    if (!response.ok) {
        console.error('Failed to fetch likes batch:', response.status)
        return { byPostId: {}, byCommentId: {} }
    }

    return response.json() as Promise<LikesBatchResponse>
}

// Posts/comments live in content-service's own database, separate from likes
// (engagement-service), so likes are composed back onto them via an HTTP call
// instead of a SQL join.
export async function attachLikesToPosts<T extends PlainPostLike>(posts: T[], authHeader?: string): Promise<T[]> {
    const postIds = posts.map(p => p.id)
    const commentIds = posts.flatMap(p => p.comments?.map(c => c.id) ?? [])

    const { byPostId, byCommentId } = await fetchLikesBatch(postIds, commentIds, authHeader)

    for (const post of posts) {
        post.likes = byPostId[post.id] ?? []
        for (const comment of post.comments ?? []) {
            comment.likes = byCommentId[comment.id] ?? []
        }
    }

    return posts
}

export async function attachLikesToComment<T extends PlainCommentLike>(comment: T, authHeader?: string): Promise<T> {
    const { byCommentId } = await fetchLikesBatch([], [comment.id], authHeader)
    comment.likes = byCommentId[comment.id] ?? []
    return comment
}
