import config from 'config'
import { sign } from 'jsonwebtoken'

export function getInternalServiceAuthHeader(): string {
    const token = sign({ id: 'system' }, config.get<string>('app.encryptionKey'))
    return `Bearer ${token}`
}

export async function persistImage(type: 'post-image' | 'avatar', source: string, authHeader?: string): Promise<string> {
    const mediaServiceUrl = config.get<string>('services.media.url')
    const response = await fetch(`${mediaServiceUrl}/media/persist-image`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader ?? getInternalServiceAuthHeader(),
        },
        body: JSON.stringify({ type, source }),
    })

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'image persistence failed' }))
        throw { status: response.status, message: (errorBody as { message?: string }).message ?? 'image persistence failed' }
    }

    const { url } = await response.json() as { url: string }
    return url
}
