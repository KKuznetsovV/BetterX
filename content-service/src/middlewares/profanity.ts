import type { NextFunction, Request, Response } from 'express'
import config from 'config'

interface ProfanityCheckPayload {
    title?: string
    body?: string
    explicitContentEnabled?: boolean
}

type ModerationAction = 'hard_block' | 'soft_filter' | 'allow'

export interface ProfanityCheckResult {
    hasProfanity: boolean
    tier: 'tier1' | 'tier2' | 'tier3'
    category: string
    action: ModerationAction
    reasons: string[]
    filtered: {
        title?: string
        body?: string
    }
    userMessage: string
    appendMedicalCommunityNote: boolean
    medicalCommunityNote: string
    monitorCryptoSpam: boolean
    requiresReview: boolean
}

function appendMedicalNote(body: string, note: string): string {
    if (!note) return body
    if (body.includes(note)) return body
    return `${body.trim()}\n\n${note}`.trim()
}

export async function checkProfanityWithOpenAI(payload: ProfanityCheckPayload, authHeader?: string): Promise<ProfanityCheckResult> {
    const aiServiceUrl = config.get<string>('services.ai.url')
    const response = await fetch(`${aiServiceUrl}/drafts/check-profanity`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify(payload),
    })

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'moderation check failed' }))
        throw { status: response.status, message: (errorBody as { message?: string }).message ?? 'moderation check failed' }
    }

    return response.json() as Promise<ProfanityCheckResult>
}

export default function profanityGuard(fields: Array<keyof ProfanityCheckPayload>) {
    return async (request: Request, _response: Response, next: NextFunction) => {
        try {
            const payload: ProfanityCheckPayload = {}
            if (fields.includes('title') && typeof request.body?.title === 'string') payload.title = request.body.title
            if (fields.includes('body') && typeof request.body?.body === 'string') payload.body = request.body.body

            const result = await checkProfanityWithOpenAI(payload, request.get('Authorization'))
            if (result.action === 'hard_block') {
                return next({
                    status: 422,
                    message: result.userMessage,
                    reasons: result.reasons,
                    tier: result.tier,
                    category: result.category,
                })
            }

            if (result.action === 'soft_filter') {
                if (fields.includes('title') && typeof result.filtered.title === 'string') request.body.title = result.filtered.title
                if (fields.includes('body') && typeof result.filtered.body === 'string') request.body.body = result.filtered.body
            }

            if (result.appendMedicalCommunityNote && fields.includes('body') && typeof request.body?.body === 'string') {
                request.body.body = appendMedicalNote(request.body.body, result.medicalCommunityNote)
            }

            next()
        } catch (e) {
            next(e)
        }
    }
}
