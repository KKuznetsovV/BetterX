import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type PostCommentDraft from '../../models/PostCommentDraft'
import type PostComment from '../../models/PostComment'
import type ImproveResult from '../../models/ImproveResult'
import { IMPROVE_STYLES, IMPROVE_STYLE_LABELS } from '../../models/ImproveStyle'
import type { ImproveStyle } from '../../models/ImproveStyle'
import commentsService from '../../../services/comments'
import useService from '../../../hooks/use-service'
import DraftsService from '../../../services/auth-aware/DraftsService'
import SpinnerButton from '../../common/spinner-button/SpinnerButton'
import InlineToast from '../../common/inline-toast/InlineToast'
import type { InlineToastTone } from '../../common/inline-toast/InlineToast'
import './NewComment.css'

interface NewCommentProps {
    postId: string
    onCreated?: (comment: PostComment) => void
}

export default function NewComment(props: NewCommentProps) {
    const { postId, onCreated } = props
    const { handleSubmit, register, reset, getValues, setValue, formState } = useForm<PostCommentDraft>()
    const draftsService = useService(DraftsService)
    const [improveResult, setImproveResult] = useState<ImproveResult | null>(null)
    const [improveStyle, setImproveStyle] = useState<ImproveStyle>('professional')
    const [isImproving, setIsImproving] = useState(false)
    const [moderationToast, setModerationToast] = useState<{ message: string; tone: InlineToastTone } | null>(null)

    function showModerationToast(message: string, tone: InlineToastTone = 'info') {
        setModerationToast({ message, tone })
    }

    async function handleImprove() {
        const body = getValues('body')
        if (!body?.trim()) return
        setIsImproving(true)
        try {
            const result = await draftsService.improve(body, improveStyle)
            setImproveResult(result)
        } catch (e) {
            alert(e)
        } finally {
            setIsImproving(false)
        }
    }

    function handlePickVersion(version: 'original' | 'improved') {
        if (!improveResult) return
        setValue('body', version === 'original' ? improveResult.original : improveResult.improved)
        setImproveResult(null)
    }

    async function createComment(draft: PostCommentDraft) {
        try {
            const profanity = await draftsService.checkProfanity({ body: draft.body })
            if (profanity.action === 'hard_block' || profanity.hasProfanity) {
                showModerationToast(profanity.userMessage ?? `Profanity detected${profanity.reasons.length ? `: ${profanity.reasons.join(', ')}` : ''}`, 'error')
                return
            }
            if (profanity.action === 'soft_filter') {
                showModerationToast(profanity.userMessage ?? 'Some language was automatically filtered to match our community guidelines.', 'warning')
            }
            if (profanity.appendMedicalCommunityNote) {
                showModerationToast('A medical community note will be added automatically to this comment.', 'info')
            }
            if (profanity.monitorCryptoSpam || profanity.requiresReview) {
                showModerationToast('This comment may be placed under additional automated crypto-safety monitoring.', 'warning')
            }

            const comment = await commentsService.addComment(postId, draft)
            reset()
            setImproveResult(null)
            setModerationToast(null)
            onCreated?.(comment)
        } catch (e) {
            const err = e as { response?: { data?: { message?: string } }; message?: string }
            alert(err?.response?.data?.message ?? err?.message ?? 'Failed to add comment')
        }
    }

    return (
        <div className='NewComment'>
            <div className="new-comment-improve-styles">
                {IMPROVE_STYLES.map(s => (
                    <button key={s} type="button"
                        className={`new-comment-improve-style-btn${improveStyle === s ? ' new-comment-improve-style-btn--active' : ''}`}
                        onClick={() => setImproveStyle(s)}>
                        {IMPROVE_STYLE_LABELS[s]}
                    </button>
                ))}
            </div>
            <form className="new-comment-form" onSubmit={handleSubmit(createComment)}>
                <input
                    className="new-comment-input"
                    type="text"
                    placeholder="Write a comment..."
                    {...register('body', {
                        required: { value: true, message: 'Comment is required' },
                        minLength: { value: 10, message: 'Comment must be at least 10 characters' }
                    })}
                />
                <SpinnerButton className="new-comment-improve-btn" type="button" label="✨ Improve" loadingLabel="Improving..." isLoading={isImproving} onClick={handleImprove} />
                <SpinnerButton className="new-comment-submit" type="submit" label="Add Comment" loadingLabel="Adding comment..." isLoading={formState.isSubmitting} />
            </form>
            {moderationToast && (
                <InlineToast
                    message={moderationToast.message}
                    tone={moderationToast.tone}
                    onClose={() => setModerationToast(null)}
                />
            )}
            <div className='error'>{formState.errors.body?.message}</div>
            {improveResult && (
                <div className="new-comment-improve-picker">
                    <div className="new-comment-improve-option">
                        <span className="new-comment-improve-option-label">Original</span>
                        <span className="new-comment-improve-option-text">{improveResult.original}</span>
                        <button type="button" className="new-comment-improve-select-btn" onClick={() => handlePickVersion('original')}>Use Original</button>
                    </div>
                    <div className="new-comment-improve-option new-comment-improve-option--ai">
                        <span className="new-comment-improve-option-label">✨ AI Improved</span>
                        <span className="new-comment-improve-option-text">{improveResult.improved}</span>
                        <button type="button" className="new-comment-improve-select-btn new-comment-improve-select-btn--ai" onClick={() => handlePickVersion('improved')}>Use Improved</button>
                    </div>
                </div>
            )}
        </div>
    )
}
