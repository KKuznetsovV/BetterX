import config from 'config'
import { getInternalServiceAuthHeader } from '../identity/identity-client'

export interface PostSnapshot {
    id: string
    userId: string
    title: string
    body: string
}

export interface PaginatedPost {
    id: string
    userId: string
    title: string
    body: string
}

// Posts (title/body) live in content-service's own database, fetched here
// either to embed (backfill) or to feed into the LLM ranking prompt.
export async function fetchUserPosts(userId: string, authHeader?: string): Promise<PostSnapshot[]> {
    const contentServiceUrl = config.get<string>('services.content.url')
    const response = await fetch(`${contentServiceUrl}/posts/user/${userId}`, {
        headers: { Authorization: authHeader ?? getInternalServiceAuthHeader() },
    })

    if (!response.ok) {
        console.error('Failed to fetch posts for user:', userId, response.status)
        return []
    }

    const posts = await response.json() as { id: string; userId: string; title: string; body: string }[]
    return posts.map(({ id, userId: postUserId, title, body }) => ({ id, userId: postUserId, title, body }))
}

// Paginated listing of ALL posts, used only to backfill embeddings for posts
// that were created before this service existed (or missed an embedding call).
export async function fetchAllPostsPage(limit: number, offset: number): Promise<PaginatedPost[]> {
    const contentServiceUrl = config.get<string>('services.content.url')
    const response = await fetch(`${contentServiceUrl}/posts?limit=${limit}&offset=${offset}`, {
        headers: { Authorization: getInternalServiceAuthHeader() },
    })

    if (!response.ok) {
        console.error('Failed to fetch posts page:', response.status)
        return []
    }

    const posts = await response.json() as { id: string; userId: string; title: string; body: string }[]
    return posts.map(({ id, userId, title, body }) => ({ id, userId, title, body }))
}
