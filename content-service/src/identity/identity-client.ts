import config from 'config'
import { sign } from 'jsonwebtoken'

export function getInternalServiceAuthHeader(): string {
    const token = sign({ id: 'system' }, config.get<string>('app.encryptionKey'))
    return `Bearer ${token}`
}

export interface UserSnapshot {
    id: string
    name: string
    username: string
    avatarUrl: string | null
    [key: string]: unknown
}

interface PlainWithUser {
    id: string
    userId: string | null
    user?: UserSnapshot | null
    comments?: PlainWithUser[]
    [key: string]: unknown
}

// Posts/comments live in content-service's own database, separate from users
// (identity-service), so the author's public snapshot is composed back onto
// them here via an HTTP call instead of a SQL join.
export async function fetchUsersById(authHeader?: string): Promise<Map<string, UserSnapshot>> {
    const identityServiceUrl = config.get<string>('services.identity.url')
    const response = await fetch(`${identityServiceUrl}/users`, {
        headers: { Authorization: authHeader ?? getInternalServiceAuthHeader() },
    })

    if (!response.ok) {
        console.error('Failed to fetch users:', response.status)
        return new Map()
    }

    const users = await response.json() as UserSnapshot[]
    return new Map(users.map(u => [u.id, u]))
}

export async function attachUsersToPosts<T extends PlainWithUser>(posts: T[], authHeader?: string): Promise<T[]> {
    const usersById = await fetchUsersById(authHeader)
    for (const post of posts) {
        post.user = (post.userId && usersById.get(post.userId)) || null
        for (const comment of post.comments ?? []) {
            comment.user = (comment.userId && usersById.get(comment.userId)) || null
        }
    }
    return posts
}

export async function attachUserToComment<T extends PlainWithUser>(comment: T, authHeader?: string): Promise<T> {
    const usersById = await fetchUsersById(authHeader)
    comment.user = (comment.userId && usersById.get(comment.userId)) || null
    return comment
}

// Returns the ids of the users the caller (identified by authHeader's JWT) follows.
export async function fetchFollowingIds(authHeader?: string): Promise<string[]> {
    const identityServiceUrl = config.get<string>('services.identity.url')
    const response = await fetch(`${identityServiceUrl}/follows/following`, {
        headers: { Authorization: authHeader ?? getInternalServiceAuthHeader() },
    })

    if (!response.ok) {
        console.error('Failed to fetch following list:', response.status)
        return []
    }

    const following = await response.json() as Array<{ id: string }>
    return following.map(u => u.id)
}

// Returns the ids of the users following the caller (identified by authHeader's JWT).
export async function fetchFollowerIds(authHeader?: string): Promise<string[]> {
    const identityServiceUrl = config.get<string>('services.identity.url')
    const response = await fetch(`${identityServiceUrl}/follows/followers`, {
        headers: { Authorization: authHeader ?? getInternalServiceAuthHeader() },
    })

    if (!response.ok) {
        console.error('Failed to fetch followers list:', response.status)
        return []
    }

    const followers = await response.json() as Array<{ id: string }>
    return followers.map(u => u.id)
}
