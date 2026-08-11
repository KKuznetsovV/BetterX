import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAvatar } from '../../../utils/avatar'
import type PostComment from '../../models/PostComment'
import type PostCommentDraft from '../../models/PostCommentDraft'
import type ImproveResult from '../../models/ImproveResult'
import { IMPROVE_STYLES, IMPROVE_STYLE_LABELS } from '../../models/ImproveStyle'
import type { ImproveStyle } from '../../models/ImproveStyle'
import NewComment from '../newcomment/NewComment'
import useUser from '../../../hooks/use-user'
import useService from '../../../hooks/use-service'
import SpinnerButton from '../../common/spinner-button/SpinnerButton'
import LikesService from '../../../services/auth-aware/LikesService'
import DraftsService from '../../../services/auth-aware/DraftsService'
import commentsService from '../../../services/comments'
import InlineToast from '../../common/inline-toast/InlineToast'
import type { InlineToastTone } from '../../common/inline-toast/InlineToast'
import { useAppDispatch } from '../../../redux/hooks'
import { addComment, addLike as addLikeProfile, removeLike as removeLikeProfile } from '../../../redux/profile-slice'
import { addComment as addCommentFeed, addLike as addLikeFeed, removeLike as removeLikeFeed } from '../../../redux/feed-slice'
import './Comments.css'

function buildCommentTree(flat: PostComment[]): PostComment[] {
    const map = new Map<string, PostComment & { replies: PostComment[] }>()
    for (const c of flat) map.set(c.id, { ...c, replies: [] })
    const roots: PostComment[] = []
    for (const c of map.values()) {
        if (c.parentId) {
            const parent = map.get(c.parentId)
            if (parent) parent.replies.push(c)
        } else {
            roots.push(c)
        }
    }
    return roots
}

const EMOJIS = ['\ud83d\udc4d', '\u2764\ufe0f', '\ud83d\ude02', '\ud83d\ude2e', '\ud83d\ude22']

interface CommentsProps {
    postId: string
    comments: PostComment[]
    onDelete?: (commentId: string) => Promise<void>
    onUpdate?: (commentId: string, draft: PostCommentDraft) => Promise<void>
    autoOpen?: boolean
    focusCommentId?: string
}

interface CommentCardProps {
    comment: PostComment
    postId: string
    depth: number
    onDelete?: CommentsProps['onDelete']
    onUpdate?: CommentsProps['onUpdate']
    onCommentAdded: (comment: PostComment) => void
    focusCommentId?: string
}

function hasDescendantComment(comment: PostComment, targetCommentId: string): boolean {
    const replies = comment.replies ?? []
    for (const reply of replies) {
        if (reply.id === targetCommentId || hasDescendantComment(reply, targetCommentId)) return true
    }
    return false
}

function CommentCard({ comment, postId, depth, onDelete, onUpdate, onCommentAdded, focusCommentId }: CommentCardProps) {
    const currentUser = useUser()
    const navigate = useNavigate()
    const dispatch = useAppDispatch()
    const likesService = useService(LikesService)
    const draftsService = useService(DraftsService)

    const shouldOpenReplies = Boolean(focusCommentId && hasDescendantComment(comment, focusCommentId))
    const [showReplies, setShowReplies] = useState(shouldOpenReplies)
    const [replyOpen, setReplyOpen] = useState(false)
    const [replyBody, setReplyBody] = useState('')
    const [isReplying, setIsReplying] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [editBody, setEditBody] = useState('')
    const [editImproveResult, setEditImproveResult] = useState<ImproveResult | null>(null)
    const [editImproveStyle, setEditImproveStyle] = useState<ImproveStyle>('professional')
    const [isImprovingEditBody, setIsImprovingEditBody] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [moderationToast, setModerationToast] = useState<{ message: string; tone: InlineToastTone } | null>(null)

    function showModerationToast(message: string, tone: InlineToastTone = 'info') {
        setModerationToast({ message, tone })
    }

    const replies = comment.replies ?? []
    const isFocusedComment = focusCommentId === comment.id
    const myLike = (comment.likes ?? []).find(l => l.userId === currentUser?.id)
    const emojiCounts = (comment.likes ?? []).reduce<Record<string, number>>((acc, l) => {
        acc[l.emoji] = (acc[l.emoji] ?? 0) + 1
        return acc
    }, {})

    useEffect(() => {
        if (shouldOpenReplies) setShowReplies(true)
    }, [shouldOpenReplies])

    async function handleSave() {
        if (!onUpdate) return
        setIsSaving(true)
        try {
            const bodyChanged = editBody.trim() !== comment.body.trim()
            if (bodyChanged) {
                const profanity = await draftsService.checkProfanity({ body: editBody })
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
            }

            await onUpdate(comment.id, { body: editBody })
            setEditOpen(false)
            setModerationToast(null)
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to save comment'
            alert(msg)
        } finally {
            setIsSaving(false)
        }
    }

    async function handleImproveEditBody() {
        if (!editBody.trim()) return
        setIsImprovingEditBody(true)
        try {
            const result = await draftsService.improve(editBody, editImproveStyle)
            setEditImproveResult(result)
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to improve comment'
            alert(msg)
        } finally {
            setIsImprovingEditBody(false)
        }
    }

    function handlePickEditVersion(version: 'original' | 'improved') {
        if (!editImproveResult) return
        setEditBody(version === 'original' ? editImproveResult.original : editImproveResult.improved)
        setEditImproveResult(null)
    }

    async function handleDelete() {
        if (!onDelete) return
        setIsDeleting(true)
        try {
            await onDelete(comment.id)
        } finally {
            setIsDeleting(false)
        }
    }

    async function handleReply() {
        if (!replyBody.trim()) return
        setIsReplying(true)
        try {
            const profanity = await draftsService.checkProfanity({ body: replyBody })
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

            const newComment = await commentsService.addComment(postId, { body: replyBody, parentId: comment.id })
            onCommentAdded(newComment)
            setReplyBody('')
            setReplyOpen(false)
            setShowReplies(true)
            setModerationToast(null)
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to add reply'
            alert(msg)
        } finally {
            setIsReplying(false)
        }
    }

    async function handleLike(emoji: string) {
        if (!currentUser) return
        setShowEmojiPicker(false)
        if (myLike?.emoji === emoji) {
            await likesService.unlikeComment(comment.id)
            dispatch(removeLikeProfile({ userId: currentUser.id, commentId: comment.id }))
            dispatch(removeLikeFeed({ userId: currentUser.id, commentId: comment.id }))
        } else {
            const like = await likesService.likeComment(comment.id, emoji)
            dispatch(addLikeProfile(like))
            dispatch(addLikeFeed(like))
        }
    }

    return (
        <div id={`comment-${comment.id}`} className={`comment${depth > 0 ? ' comment--reply' : ''}${isFocusedComment ? ' comment--target' : ''}`}>
            <div className="comment-meta">
                {comment.userId && comment.user
                    ? <button type="button" className="comment-meta-avatar-btn" onClick={() => navigate(comment.userId === currentUser?.id ? '/profile' : `/profile/${comment.userId}`, { state: { user: comment.user } })}>
                        <img className="comment-meta-avatar" src={getAvatar(comment.user.avatarUrl)} alt={comment.user.name} />
                      </button>
                    : <span className="comment-meta-avatar-placeholder" />
                }
                {comment.userId && comment.user
                    ? <button type="button" className="comment-meta-name" onClick={() => navigate(comment.userId === currentUser?.id ? '/profile' : `/profile/${comment.userId}`, { state: { user: comment.user } })}>{comment.user.name}</button>
                    : <span className="comment-meta-name">Deleted User</span>
                }
                <span className="comment-meta-sep">·</span>
                <span>{comment.createdAt}</span>
            </div>
            {editOpen ? (
                <div className="comment-edit">
                    <input className="comment-edit-input" value={editBody} onChange={e => setEditBody(e.target.value)} />
                    <div className="comment-edit-improve-styles">
                        {IMPROVE_STYLES.map(s => (
                            <button
                                key={s}
                                type="button"
                                className={`comment-edit-improve-style-btn${editImproveStyle === s ? ' comment-edit-improve-style-btn--active' : ''}`}
                                onClick={() => setEditImproveStyle(s)}
                            >
                                {IMPROVE_STYLE_LABELS[s]}
                            </button>
                        ))}
                    </div>
                    <SpinnerButton
                        className="comment-edit-improve-btn"
                        type="button"
                        label="✨ Improve"
                        loadingLabel="Improving..."
                        isLoading={isImprovingEditBody}
                        onClick={handleImproveEditBody}
                    />
                    {editImproveResult && (
                        <div className="comment-edit-improve-picker">
                            <div className="comment-edit-improve-option">
                                <span className="comment-edit-improve-option-label">Original</span>
                                <span className="comment-edit-improve-option-text">{editImproveResult.original}</span>
                                <button type="button" className="comment-edit-improve-select-btn" onClick={() => handlePickEditVersion('original')}>Use Original</button>
                            </div>
                            <div className="comment-edit-improve-option comment-edit-improve-option--ai">
                                <span className="comment-edit-improve-option-label">✨ AI Improved</span>
                                <span className="comment-edit-improve-option-text">{editImproveResult.improved}</span>
                                <button type="button" className="comment-edit-improve-select-btn comment-edit-improve-select-btn--ai" onClick={() => handlePickEditVersion('improved')}>Use Improved</button>
                            </div>
                        </div>
                    )}
                    <div className="comment-edit-actions">
                        <button className="comment-save-button" type="button" disabled={isSaving} onClick={handleSave}>
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button className="comment-cancel-button" type="button" onClick={() => { setEditOpen(false); setEditImproveResult(null); setModerationToast(null) }}>Cancel</button>
                    </div>
                </div>
            ) : (
                <div className="comment-body">{comment.body}</div>
            )}
            {moderationToast && (
                <InlineToast
                    message={moderationToast.message}
                    tone={moderationToast.tone}
                    onClose={() => setModerationToast(null)}
                />
            )}
            <div className="comment-reactions">
                <div className="comment-reaction-counts">
                    {Object.entries(emojiCounts).map(([emoji, count]) => (
                        <span key={emoji} className="comment-reaction-count">{emoji} {count}</span>
                    ))}
                </div>
                <div className="comment-reaction-btn-wrap" onMouseEnter={() => setShowEmojiPicker(true)} onMouseLeave={() => setShowEmojiPicker(false)}>
                    <button type="button" className={`comment-reaction-btn${myLike ? ' comment-reaction-btn--active' : ''}`}>
                        {myLike ? `${myLike.emoji} Liked` : '\ud83d\udc4d'}
                    </button>
                    {showEmojiPicker && (
                        <div className="comment-emoji-picker">
                            {EMOJIS.map(e => (
                                <button key={e} type="button" className={`emoji-option${myLike?.emoji === e ? ' emoji-option--active' : ''}`} onClick={() => handleLike(e)}>{e}</button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="comment-actions">
                {currentUser && (
                    <button type="button" className="comment-reply-button" onClick={() => { setReplyOpen(o => !o); setReplyBody('') }}>
                        Reply
                    </button>
                )}
                {comment.userId === currentUser?.id && (
                    <>
                        {onUpdate && !editOpen && (
                            <button className="comment-edit-button" onClick={() => { setEditOpen(true); setEditBody(comment.body); setEditImproveResult(null); setModerationToast(null) }}>Edit</button>
                        )}
                        {onDelete && (
                            <SpinnerButton className="comment-delete-button" type="button" label="Delete" loadingLabel="Deleting..." isLoading={isDeleting} onClick={handleDelete} />
                        )}
                    </>
                )}
            </div>
            {replyOpen && (
                <div className="comment-reply-form">
                    <input
                        className="comment-reply-input"
                        value={replyBody}
                        placeholder={`Reply to ${comment.user?.name ?? 'comment'}...`}
                        onChange={e => setReplyBody(e.target.value)}
                        autoFocus
                    />
                    <div className="comment-reply-actions">
                        <SpinnerButton type="button" className="comment-reply-submit" label="Reply" loadingLabel="Replying..." isLoading={isReplying} onClick={handleReply} />
                        <button type="button" className="comment-cancel-button" onClick={() => setReplyOpen(false)}>Cancel</button>
                    </div>
                </div>
            )}
            {replies.length > 0 && (
                <button type="button" className="comment-replies-toggle" onClick={() => setShowReplies(o => !o)}>
                    {showReplies ? '\u25b2 Hide' : '\u25bc Show'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </button>
            )}
            {showReplies && (
                <div className="comment-replies">
                    {replies.map(reply => (
                        <CommentCard
                            key={reply.id}
                            comment={reply}
                            postId={postId}
                            depth={depth + 1}
                            onDelete={onDelete}
                            onUpdate={onUpdate}
                            onCommentAdded={onCommentAdded}
                            focusCommentId={focusCommentId}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export default function Comments(props: CommentsProps) {
    const { postId, comments, onDelete, onUpdate, autoOpen = false, focusCommentId } = props
    const dispatch = useAppDispatch()
    const [open, setOpen] = useState(autoOpen)

    const tree = buildCommentTree(comments)

    function handleCommentAdded(comment: PostComment) {
        dispatch(addComment(comment))
        dispatch(addCommentFeed(comment))
    }

    useEffect(() => {
        if (autoOpen) setOpen(true)
    }, [autoOpen])

    return (
        <div className="comments">
            <button type="button" className="comments-header" onClick={() => setOpen(o => !o)}>
                <span className="comments-header-icon">💬</span>
                <span className="comments-header-label">{comments.length} Comment{comments.length !== 1 ? 's' : ''}</span>
                <span className="comments-header-chevron">{open ? '\u25b2' : '\u25bc'}</span>
            </button>
            {open && (
                <>
                    <NewComment postId={postId} onCreated={handleCommentAdded} />
                    {tree.map(comment => (
                        <CommentCard
                            key={comment.id}
                            comment={comment}
                            postId={postId}
                            depth={0}
                            onDelete={onDelete}
                            onUpdate={onUpdate}
                            onCommentAdded={handleCommentAdded}
                            focusCommentId={focusCommentId}
                        />
                    ))}
                </>
            )}
        </div>
    )
}
