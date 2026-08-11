import { useState, useRef, useEffect } from 'react';
import type { AxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import type PostModel from '../models/Post';
import type PostCommentDraft from '../models/PostCommentDraft';
import type ImproveResult from '../models/ImproveResult';
import type GenerateImageResult from '../models/GenerateImageResult';
import { IMPROVE_STYLES, IMPROVE_STYLE_LABELS } from '../models/ImproveStyle';
import type { ImproveStyle } from '../models/ImproveStyle';
import Comments from '../posts/comments/Comments';
import commentsService from '../../services/comments';
import { displayDate } from '../../utils/date';
import { getAvatar } from '../../utils/avatar';
import useUser from '../../hooks/use-user';
import useService from '../../hooks/use-service';
import ProfileService from '../../services/auth-aware/ProfileService';
import LikesService from '../../services/auth-aware/LikesService';
import UploadsService from '../../services/auth-aware/UploadsService';
import DraftsService from '../../services/auth-aware/DraftsService';
import SpinnerButton from '../common/spinner-button/SpinnerButton';
import ContentGuidelinesModal from '../common/content-guidelines/ContentGuidelinesModal';
import InlineToast from '../common/inline-toast/InlineToast';
import type { InlineToastTone } from '../common/inline-toast/InlineToast';
import { validateImageFile } from '../../utils/image-validator';
import { useAppDispatch } from '../../redux/hooks';
import { remove, update, addLike as addLikeProfile, removeLike as removeLikeProfile, removeComment } from '../../redux/profile-slice';
import { addLike as addLikeFeed, removeLike as removeLikeFeed, updatePost as updatePostFeed, removeComment as removeCommentFeed } from '../../redux/feed-slice';
import './Post.css';

interface PostProps {
    post: PostModel;
    isReadOnly: boolean;
    isNotificationTarget?: boolean;
    focusCommentId?: string | null;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢']

export default function Post(props: PostProps) {
    const { isReadOnly } = props;
    const { id, userId, title, body, createdAt, user } = props.post;
    const currentUser = useUser();
    const isOwner = currentUser?.id === userId;
    const profileService = useService(ProfileService);
    const likesService = useService(LikesService);
    const uploadsService = useService(UploadsService);
    const draftsService = useService(DraftsService);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const [comments, setComments] = useState(props.post.comments);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(title);
    const [editBody, setEditBody] = useState(body);
    const [editImageMode, setEditImageMode] = useState<'keep' | 'url' | 'file' | 'remove'>('keep');
    const [editImageUrl, setEditImageUrl] = useState('');
    const [editImageFile, setEditImageFile] = useState<File | null>(null);
    const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
    const editFileInputRef = useRef<HTMLInputElement>(null);
    const [editImproveResult, setEditImproveResult] = useState<ImproveResult | null>(null);
    const [editImproveStyle, setEditImproveStyle] = useState<ImproveStyle>('professional');
    const [isImprovingEditBody, setIsImprovingEditBody] = useState(false);
    const [editGeneratedImage, setEditGeneratedImage] = useState<GenerateImageResult | null>(null);
    const [isGeneratingEditImage, setIsGeneratingEditImage] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);
    const [editModerationToast, setEditModerationToast] = useState<{ message: string; tone: InlineToastTone } | null>(null);
    const [bodyExpanded, setBodyExpanded] = useState(false);
    const [isBodyOverflowing, setIsBodyOverflowing] = useState(false);
    const bodyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = bodyRef.current;
        if (el) setIsBodyOverflowing(el.scrollHeight > el.clientHeight);
    }, [editBody]);

    const myLike = props.post.likes?.find(l => l.userId === currentUser?.id)
    const emojiCounts = (props.post.likes ?? []).reduce<Record<string, number>>((acc, l) => {
        acc[l.emoji] = (acc[l.emoji] ?? 0) + 1
        return acc
    }, {})

    useEffect(() => {
        setComments(props.post.comments);
    }, [props.post.comments]);

    useEffect(() => {
        setEditTitle(props.post.title);
        setEditBody(props.post.body);
    }, [props.post.title, props.post.body]);

    useEffect(() => {
        if (!props.isNotificationTarget) return;
        const element = document.getElementById(`post-${id}`);
        if (element) {
            window.setTimeout(() => {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 60);
        }
    }, [props.isNotificationTarget, id]);

    function resetEditImage() {
        setEditImageMode('keep');
        setEditImageUrl('');
        setEditImageFile(null);
        setEditImagePreview(null);
        setEditGeneratedImage(null);
        if (editFileInputRef.current) editFileInputRef.current.value = '';
    }

    function resetEditAi() {
        setEditImproveResult(null);
        setEditGeneratedImage(null);
    }

    function showEditModerationToast(message: string, tone: InlineToastTone = 'info') {
        setEditModerationToast({ message, tone });
    }

    function handleEditFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const err = validateImageFile(file);
        if (err) { alert(err); if (editFileInputRef.current) editFileInputRef.current.value = ''; return; }
        setEditImageFile(file);
        setEditImagePreview(URL.createObjectURL(file));
    }

    async function handleUpdateComment(commentId: string, draft: PostCommentDraft) {
        await commentsService.updateComment(id, commentId, draft);
    }

    async function handleDeleteComment(commentId: string) {
        await commentsService.deleteComment(id, commentId);
        dispatch(removeComment({ id: commentId, postId: id }))
        dispatch(removeCommentFeed({ id: commentId, postId: id }))
        setComments(prev => prev.filter(c => c.id !== commentId))
    }

    async function handleImproveEditBody() {
        if (!editBody.trim()) return;
        setIsImprovingEditBody(true);
        try {
            const result = await draftsService.improve(editBody, editImproveStyle);
            setEditImproveResult(result);
        } catch (e) {
            const msg = (e as AxiosError<{ message: string }>).response?.data?.message ?? (e as Error).message ?? 'Failed to improve text';
            alert(msg);
        } finally {
            setIsImprovingEditBody(false);
        }
    }

    function handlePickEditVersion(version: 'original' | 'improved') {
        if (!editImproveResult) return;
        setEditBody(version === 'original' ? editImproveResult.original : editImproveResult.improved);
        setEditImproveResult(null);
    }

    async function handleGenerateEditImage() {
        const prompt = [editTitle.trim(), editBody.trim()].filter(Boolean).join('\n\n');
        if (!prompt) return;
        setIsGeneratingEditImage(true);
        try {
            const result = await draftsService.generateImage(prompt);
            setEditGeneratedImage(result);
        } catch (e) {
            const msg = (e as AxiosError<{ message: string }>).response?.data?.message ?? (e as Error).message ?? 'Failed to generate image';
            alert(msg);
        } finally {
            setIsGeneratingEditImage(false);
        }
    }

    function handleUseGeneratedEditImage() {
        if (!editGeneratedImage) return;
        setEditImageMode('url');
        setEditImageFile(null);
        setEditImageUrl(editGeneratedImage.url);
        setEditImagePreview(editGeneratedImage.url);
        setEditGeneratedImage(null);
    }

    async function handleSavePost() {
        setIsSaving(true);
        try {
            const titleChanged = editTitle.trim() !== props.post.title.trim()
            const bodyChanged = editBody.trim() !== props.post.body.trim()
            if (titleChanged || bodyChanged) {
                const profanity = await draftsService.checkProfanity({ title: editTitle, body: editBody })
                if (profanity.action === 'hard_block' || profanity.hasProfanity) {
                    showEditModerationToast(profanity.userMessage ?? `Profanity detected${profanity.reasons.length ? `: ${profanity.reasons.join(', ')}` : ''}`, 'error')
                    return
                }
                if (profanity.action === 'soft_filter') {
                    showEditModerationToast(profanity.userMessage ?? 'Some language was automatically filtered to match our community guidelines.', 'warning')
                }
                if (profanity.appendMedicalCommunityNote) {
                    showEditModerationToast('A medical community note will be added automatically to this post.', 'info')
                }
                if (profanity.monitorCryptoSpam || profanity.requiresReview) {
                    showEditModerationToast('This post may be placed under additional automated crypto-safety monitoring.', 'warning')
                }
            }

            let updatedPost: PostModel;
            if (editImageMode === 'file' && editImageFile) {
                const imageUrl = await uploadsService.uploadFile(editImageFile, 'post-image');
                updatedPost = await profileService.updatePost(id, { title: editTitle, body: editBody, imageUrl });
            } else {
                const imageUrl = editImageMode === 'url' ? editImageUrl
                    : editImageMode === 'remove' ? null
                    : props.post.imageUrl ?? undefined;
                updatedPost = await profileService.updatePost(id, { title: editTitle, body: editBody, imageUrl });
            }
            dispatch(update({ id, title: updatedPost.title, body: updatedPost.body, imageUrl: updatedPost.imageUrl }));
            dispatch(updatePostFeed({ id, title: updatedPost.title, body: updatedPost.body, imageUrl: updatedPost.imageUrl }));
            setIsEditing(false);
            resetEditAi();
            resetEditImage();
            setEditModerationToast(null);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to save post');
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDeletePost() {
        if (!confirm('Are you sure you want to delete this post?')) return;
        setIsDeleting(true);
        try {
            await profileService.deletePost(id);
            dispatch(remove({ id }));
        } catch (err) {
            alert(err);
            setIsDeleting(false);
        }
    }

    async function handleLikePost(emoji: string) {
        if (!currentUser) return
        setShowEmojiPicker(false)
        if (myLike?.emoji === emoji) {
            await likesService.unlikePost(id)
            dispatch(removeLikeProfile({ userId: currentUser.id, postId: id }))
            dispatch(removeLikeFeed({ userId: currentUser.id, postId: id }))
        } else {
            const like = await likesService.likePost(id, emoji)
            dispatch(addLikeProfile(like))
            dispatch(addLikeFeed(like))
        }
    }

    return (
        <div id={`post-${id}`} className={`post${lightboxOpen ? ' post--lightbox-open' : ''}${props.isNotificationTarget ? ' post--target' : ''}`}>
            {isEditing ? (
                <div className="post-edit">
                    <input
                        className="post-edit-title"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                    />
                    <textarea
                        className="post-edit-body"
                        rows={5}
                        value={editBody}
                        onChange={e => setEditBody(e.target.value)}
                    />
                    <p className="post-edit-guidelines">
                        Please follow our{' '}
                        <button type="button" className="post-edit-guidelines-link" onClick={() => setIsGuidelinesOpen(true)}>
                            Content Guidelines
                        </button>
                        .
                    </p>
                    {editModerationToast && (
                        <InlineToast
                            message={editModerationToast.message}
                            tone={editModerationToast.tone}
                            onClose={() => setEditModerationToast(null)}
                        />
                    )}
                    <div className="post-edit-improve-styles">
                        {IMPROVE_STYLES.map(s => (
                            <button
                                key={s}
                                type="button"
                                className={`post-edit-improve-style-btn${editImproveStyle === s ? ' post-edit-improve-style-btn--active' : ''}`}
                                onClick={() => setEditImproveStyle(s)}
                            >
                                {IMPROVE_STYLE_LABELS[s]}
                            </button>
                        ))}
                    </div>
                    <SpinnerButton
                        className="post-edit-improve-btn"
                        type="button"
                        label="✨ Improve with AI"
                        loadingLabel="Improving..."
                        isLoading={isImprovingEditBody}
                        onClick={handleImproveEditBody}
                    />
                    {editImproveResult && (
                        <div className="post-edit-improve-picker">
                            <div className="post-edit-improve-option">
                                <div className="post-edit-improve-option-label">Original</div>
                                <div className="post-edit-improve-option-text">{editImproveResult.original}</div>
                                <button type="button" className="post-edit-improve-select-btn" onClick={() => handlePickEditVersion('original')}>Use Original</button>
                            </div>
                            <div className="post-edit-improve-option post-edit-improve-option--ai">
                                <div className="post-edit-improve-option-label">✨ AI Improved</div>
                                <div className="post-edit-improve-option-text">{editImproveResult.improved}</div>
                                <button type="button" className="post-edit-improve-select-btn post-edit-improve-select-btn--ai" onClick={() => handlePickEditVersion('improved')}>Use Improved</button>
                            </div>
                        </div>
                    )}
                    <div className="post-edit-image-section">
                        <div className="post-edit-image-actions">
                            {props.post.imageUrl && (
                                <button type="button"
                                    className={`new-post-image-action-btn${editImageMode === 'remove' ? ' active' : ''}`}
                                    onClick={() => setEditImageMode(editImageMode === 'remove' ? 'keep' : 'remove')}>
                                    Remove image
                                </button>
                            )}
                            <button type="button"
                                className={`new-post-image-action-btn${editImageMode === 'url' ? ' active' : ''}`}
                                onClick={() => { setEditImageMode(editImageMode === 'url' ? 'keep' : 'url'); setEditImageFile(null); setEditImagePreview(null); }}>
                                Change URL
                            </button>
                            <button type="button"
                                className={`new-post-image-action-btn${editImageMode === 'file' ? ' active' : ''}`}
                                onClick={() => { setEditImageMode(editImageMode === 'file' ? 'keep' : 'file'); setEditImageUrl(''); }}>
                                Upload new
                            </button>
                            <SpinnerButton
                                className="post-edit-generate-image-btn"
                                type="button"
                                label="🎨 Generate with AI"
                                loadingLabel="Generating..."
                                isLoading={isGeneratingEditImage}
                                onClick={handleGenerateEditImage}
                            />
                        </div>
                        {editGeneratedImage && (
                            <div className="post-edit-generated-image">
                                <img className="new-post-image-preview" src={editGeneratedImage.url} alt="AI generated" />
                                <div className="post-edit-generated-image-prompt">🎨 {editGeneratedImage.revisedPrompt}</div>
                                <div className="post-edit-generated-image-actions">
                                    <button type="button" className="post-edit-generate-use-btn" onClick={handleUseGeneratedEditImage}>Use this image</button>
                                    <button type="button" className="post-edit-generate-discard-btn" onClick={() => setEditGeneratedImage(null)}>Discard</button>
                                </div>
                            </div>
                        )}
                        {editImageMode === 'url' && (
                            <input
                                className="post-edit-title"
                                type="url"
                                placeholder="https://example.com/image.jpg"
                                value={editImageUrl}
                                onChange={e => setEditImageUrl(e.target.value)}
                            />
                        )}
                        {editImageMode === 'file' && (
                            <input
                                ref={editFileInputRef}
                                className="new-post-file-input"
                                type="file"
                                accept="image/*"
                                onChange={handleEditFileChange}
                            />
                        )}
                        {editImageMode === 'keep' && props.post.imageUrl && (
                            <img className="post-image" src={props.post.imageUrl} alt="Current image" />
                        )}
                        {editImageMode === 'remove' && (
                            <p className="post-edit-image-remove-note">Image will be removed on save.</p>
                        )}
                        {editImageMode === 'file' && (
                            <div className="post-edit-image-compare">
                                {props.post.imageUrl && (
                                    <div className="post-edit-image-compare-item">
                                        <span className="post-edit-image-compare-label">Current</span>
                                        <img className="post-image" src={props.post.imageUrl} alt="Current image" />
                                    </div>
                                )}
                                {editImagePreview && (
                                    <div className="post-edit-image-compare-item">
                                        <span className="post-edit-image-compare-label">New</span>
                                        <img className="new-post-image-preview" src={editImagePreview} alt="New image preview" />
                                    </div>
                                )}
                            </div>
                        )}
                        {editImageMode !== 'file' && editImagePreview && (
                            <img className="new-post-image-preview" src={editImagePreview} alt="Preview" />
                        )}
                    </div>
                    <div className="post-edit-actions">
                        <SpinnerButton className="post-save-button" type="button" label="Save" loadingLabel="Saving..." isLoading={isSaving} onClick={handleSavePost} />
                        <button className="post-cancel-button" onClick={() => { setIsEditing(false); setEditTitle(title); setEditBody(body); resetEditAi(); resetEditImage(); setEditModerationToast(null); }}>Cancel</button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="post-title">{editTitle}</div>
                    <div className="post-meta">
                        <button type="button" className="post-meta-avatar-btn" onClick={() => navigate(userId === currentUser?.id ? '/profile' : `/profile/${userId}`, { state: { user } })}>
                            <img className="post-meta-avatar" src={getAvatar(user.avatarUrl)} alt={user.name} />
                        </button>
                        <button type="button" className="post-meta-author" onClick={() => navigate(userId === currentUser?.id ? '/profile' : `/profile/${userId}`, { state: { user } })}>{user.name}</button> at {displayDate(createdAt)}
                    </div>
                    <div ref={bodyRef} className={`post-body${bodyExpanded ? '' : ' post-body--collapsed'}`}>{editBody}</div>
                    {isBodyOverflowing && !bodyExpanded && (
                        <button type="button" className="post-body-expand-btn" onClick={() => setBodyExpanded(true)}>See full post</button>
                    )}
                    {props.post.imageUrl && (
                        <img className="post-image" src={props.post.imageUrl} alt="Post image" onClick={() => setLightboxOpen(true)} />
                    )}
                    {lightboxOpen && (
                        <div className="post-lightbox" onClick={() => setLightboxOpen(false)}>
                            <button className="post-lightbox-close" onClick={() => setLightboxOpen(false)}>✕</button>
                            <img className="post-lightbox-img" src={props.post.imageUrl!} alt="Full size" onClick={() => setLightboxOpen(false)} />
                        </div>
                    )}
                </>
            )}
            <div className="post-reactions">
                <div className="post-reaction-counts">
                    {Object.entries(emojiCounts).map(([emoji, count]) => (
                        <span key={emoji} className="post-reaction-count">{emoji} {count}</span>
                    ))}
                </div>
                <div
                    className="post-reaction-btn-wrap"
                    onMouseEnter={() => setShowEmojiPicker(true)}
                    onMouseLeave={() => setShowEmojiPicker(false)}
                >
                    <button
                        type="button"
                        className={`post-reaction-btn${myLike ? ' post-reaction-btn--active' : ''}`}
                    >
                        {myLike ? `${myLike.emoji} Liked` : '👍 Like'}
                    </button>
                    {showEmojiPicker && (
                        <div className="emoji-picker">
                            {EMOJIS.map(e => (
                                <button
                                    key={e}
                                    type="button"
                                    className={`emoji-option${myLike?.emoji === e ? ' emoji-option--active' : ''}`}
                                    onClick={() => handleLikePost(e)}
                                >{e}</button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="post-comments">
                <Comments
                    postId={id}
                    comments={comments}
                    onUpdate={handleUpdateComment}
                    onDelete={handleDeleteComment}
                    autoOpen={Boolean(props.focusCommentId)}
                    focusCommentId={props.focusCommentId ?? undefined}
                />
            </div>
            {!isReadOnly && isOwner && (
                <div className="post-actions">
                    {!isEditing && (
                        <button type="button" className="post-edit-button" onClick={() => { setIsEditing(true); resetEditAi(); setEditModerationToast(null); }}>Edit Post</button>
                    )}
                    <SpinnerButton type="button" className="post-delete-button" label="Delete Post" loadingLabel="Deleting post..." isLoading={isDeleting} onClick={handleDeletePost} />
                </div>
            )}
            {isGuidelinesOpen && <ContentGuidelinesModal onClose={() => setIsGuidelinesOpen(false)} />}
        </div>
    );
}
