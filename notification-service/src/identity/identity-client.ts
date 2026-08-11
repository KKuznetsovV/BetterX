import config from 'config'
import { sign } from 'jsonwebtoken'

export function getInternalServiceAuthHeader(): string {
    const token = sign({ id: 'system' }, config.get<string>('app.encryptionKey'))
    return `Bearer ${token}`
}

// Resolves the ids of the users following the given user. Used by the
// post.created event consumer to fan out a "new post" notification to every
// follower - there is no end-user JWT available in that context (it runs off
// a queued event, not an HTTP request), so this always calls identity-service
// with an internally-signed system JWT.
export async function fetchFollowerIds(userId: string): Promise<string[]> {
    const identityServiceUrl = config.get<string>('services.identity.url')
    const response = await fetch(`${identityServiceUrl}/follows/followers/${userId}`, {
        headers: { Authorization: getInternalServiceAuthHeader() },
    })

    if (!response.ok) {
        console.error('Failed to fetch followers list:', userId, response.status)
        return []
    }

    const followers = await response.json() as Array<{ id: string }>
    return followers.map(u => u.id)
}
