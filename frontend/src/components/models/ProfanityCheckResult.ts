export default interface ProfanityCheckResult {
    hasProfanity: boolean
    reasons: string[]
    tier?: 'tier1' | 'tier2' | 'tier3'
    category?: string
    action?: 'hard_block' | 'soft_filter' | 'allow'
    userMessage?: string
    appendMedicalCommunityNote?: boolean
    medicalCommunityNote?: string
    monitorCryptoSpam?: boolean
    requiresReview?: boolean
}
