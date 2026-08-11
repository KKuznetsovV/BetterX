import openai from '../ai/ai'

export interface ProfanityCheckPayload {
    title?: string
    body?: string
    explicitContentEnabled?: boolean
}

type ModerationTier = 'tier1' | 'tier2' | 'tier3'
type ModerationAction = 'hard_block' | 'soft_filter' | 'allow'

interface ProfanityModelResult {
    tier?: ModerationTier
    category?: string
    reasons?: string[]
    titleFiltered?: string
    bodyFiltered?: string
    appendMedicalCommunityNote?: boolean
    monitorCryptoSpam?: boolean
    requiresReview?: boolean
}

interface ModerationSignal {
    hardBlock: boolean
    categories: string[]
}

export interface ProfanityCheckResult {
    hasProfanity: boolean
    tier: ModerationTier
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

const BLOCKED_MESSAGE = 'Your post contains language that violates our community guidelines. Please edit your text to proceed.'
const FILTERED_MESSAGE = 'Some language was automatically filtered to match our community guidelines.'
const MEDICAL_COMMUNITY_NOTE = '⚠️ Community Note: This post contains user-generated content. For medical advice, diagnoses, or treatment plans, please consult with a licensed healthcare professional.'
const MODERATION_MODEL = 'omni-moderation-latest'

function toAction(tier: ModerationTier, explicitContentEnabled: boolean): ModerationAction {
    if (tier === 'tier1') return 'hard_block'
    if (tier === 'tier2') return explicitContentEnabled ? 'allow' : 'soft_filter'
    return 'allow'
}

function normalizeTier(value?: string): ModerationTier {
    if (value === 'tier1' || value === 'tier2' || value === 'tier3') return value
    return 'tier3'
}

function toResult(payload: ProfanityCheckPayload, modelResult?: ProfanityModelResult): ProfanityCheckResult {
    const explicitContentEnabled = Boolean(payload.explicitContentEnabled)
    const tier = normalizeTier(modelResult?.tier)
    const action = toAction(tier, explicitContentEnabled)
    const title = payload.title?.trim() ?? ''
    const body = payload.body?.trim() ?? ''
    const appendMedicalCommunityNote = Boolean(modelResult?.appendMedicalCommunityNote) && action !== 'hard_block'

    return {
        hasProfanity: action === 'hard_block',
        tier,
        category: modelResult?.category?.trim() || 'none',
        action,
        reasons: Array.isArray(modelResult?.reasons) ? modelResult!.reasons!.map(r => String(r)).slice(0, 5) : [],
        filtered: {
            title: action === 'soft_filter' ? (modelResult?.titleFiltered ?? title) : undefined,
            body: action === 'soft_filter' ? (modelResult?.bodyFiltered ?? body) : undefined,
        },
        userMessage: action === 'hard_block' ? BLOCKED_MESSAGE : action === 'soft_filter' ? FILTERED_MESSAGE : '',
        appendMedicalCommunityNote,
        medicalCommunityNote: appendMedicalCommunityNote ? MEDICAL_COMMUNITY_NOTE : '',
        monitorCryptoSpam: Boolean(modelResult?.monitorCryptoSpam),
        requiresReview: Boolean(modelResult?.requiresReview),
    }
}

function normalizeForModeration(text: string): string {
    return text
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

async function runModerationPrecheck(payload: ProfanityCheckPayload): Promise<ModerationSignal> {
    const title = normalizeForModeration(payload.title ?? '')
    const body = normalizeForModeration(payload.body ?? '')
    const combined = [title, body].filter(Boolean).join('\n\n')
    if (!combined) return { hardBlock: false, categories: [] }

    try {
        const result = await openai.moderations.create({
            model: MODERATION_MODEL,
            input: combined,
        })

        const entry = result.results?.[0]
        if (!entry?.categories) return { hardBlock: false, categories: [] }

        const categories = Object.entries(entry.categories)
            .filter(([, flagged]) => Boolean(flagged))
            .map(([name]) => name)

        const severePrefixes = [
            'hate',
            'harassment',
            'violence',
            'sexual',
            'self-harm',
            'illicit',
        ]

        const hardBlock = categories.some(name => severePrefixes.some(prefix => name.startsWith(prefix)))

        return { hardBlock, categories }
    } catch {
        return { hardBlock: false, categories: [] }
    }
}

export async function checkProfanityWithOpenAI(payload: ProfanityCheckPayload): Promise<ProfanityCheckResult> {
    const title = normalizeForModeration(payload.title ?? '')
    const body = normalizeForModeration(payload.body ?? '')
    if (!title && !body) {
        return toResult(payload, { tier: 'tier3', category: 'none', reasons: [] })
    }

    const moderationSignal = await runModerationPrecheck({ title, body, explicitContentEnabled: payload.explicitContentEnabled })
    if (moderationSignal.hardBlock) {
        return toResult(payload, {
            tier: 'tier1',
            category: 'multilingual_moderation_precheck',
            reasons: moderationSignal.categories.slice(0, 5),
        })
    }

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: [
                    'You are the BetterX Profanity Preventer.',
                    'You must detect policy violations in ANY language and script (including Cyrillic, Arabic, Hindi, CJK, mixed-script slang, transliteration, phonetic spelling, and obfuscated profanity).',
                    'Treat non-English text with the same strictness as English. Internally translate and normalize meaning before deciding.',
                    'Classify text into exactly one tier:',
                    '- tier1: slurs, hate speech, severe harassment, explicit sexual threats, child exploitation references, deceptive financial fraud, unregulated investment manipulation, prohibited crypto scams/promotions, and dangerous medical misinformation. Action is hard block.',
                    '- tier2: general profanity/vulgarity in non-threatening context. Action is soft filter unless explicitContentEnabled=true.',
                    '- tier3: false positives, slang, reclaimed language, medical/anatomical, pop-culture/art context that is non-abusive, and benign educational discussions. Action is allow.',
                    'Financial hard-block examples: get-rich-quick/pyramid schemes, unlicensed financial buy/sell/hold directives posing as certified advice, pump-and-dump coordination.',
                    'Crypto hard-block examples: unregulated token or NFT promotions, airdrop/phishing wallet-connect scams, fake giveaway deposit-doubling scams.',
                    'Medical hard-block examples: DIY diagnoses/treatment plans with dosages, anti-vaccine counter-scientific misinformation, dangerous alternative medicine or toxic cure claims.',
                    'Regulated crypto discussion may be allowed/monitored when educational and non-scammy. Set monitorCryptoSpam=true when content is high-frequency wallet/link spam-like and set requiresReview=true when suspicious.',
                    'Regulated health discussion from personal experience may be allowed. If post discusses specific treatments/conditions and is not hard-blocked, set appendMedicalCommunityNote=true.',
                    'Detect bypass/evasion attempts: leetspeak substitutions, punctuation padding, phonetic misspellings, and emoji innuendo.',
                    'When tier2 is detected, provide masked text versions in titleFiltered/bodyFiltered. Use masking like f*** or symbols while preserving readability.',
                    'Return only valid JSON with this exact shape:',
                    '{"tier":"tier1|tier2|tier3","category":"string","reasons":["string"],"titleFiltered":"string","bodyFiltered":"string","appendMedicalCommunityNote":boolean,"monitorCryptoSpam":boolean,"requiresReview":boolean}',
                    'Keep reasons short and specific.',
                ].join(' ')
            },
            {
                role: 'user',
                content: JSON.stringify({ title, body, explicitContentEnabled: Boolean(payload.explicitContentEnabled) })
            }
        ]
    })

    const raw = completion.choices[0].message.content ?? '{"tier":"tier3","category":"none","reasons":[]}'

    try {
        const parsed = JSON.parse(raw) as ProfanityModelResult
        return toResult(payload, parsed)
    } catch {
        return toResult(payload, {
            tier: 'tier1',
            category: 'moderation_classifier_invalid_output',
            reasons: ['classifier_invalid_output'],
        })
    }
}

export function appendMedicalNote(body: string, note: string): string {
    if (!note) return body
    if (body.includes(note)) return body
    return `${body.trim()}\n\n${note}`.trim()
}
