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
}

export async function fetchAllUsers(authHeader?: string): Promise<Map<string, UserSnapshot>> {
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

// Ids of users the authenticated user already follows, so they're excluded
// from "suggested users to follow".
export async function fetchFollowingIds(authHeader: string): Promise<string[]> {
    const identityServiceUrl = config.get<string>('services.identity.url')
    const response = await fetch(`${identityServiceUrl}/follows/following`, {
        headers: { Authorization: authHeader },
    })

    if (!response.ok) {
        console.error('Failed to fetch following:', response.status)
        return []
    }

    const following = await response.json() as { id: string }[]
    return following.map(u => u.id)
}
