export const IMPROVE_STYLES = ['professional', 'funny', 'sad', 'casual', 'inspirational'] as const
export type ImproveStyle = typeof IMPROVE_STYLES[number]
export const IMPROVE_STYLE_LABELS: Record<ImproveStyle, string> = {
    professional: '💼 Professional',
    funny: '😄 Funny',
    sad: '😢 Sad',
    casual: '😌 Casual',
    inspirational: '🌟 Inspirational',
}
