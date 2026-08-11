import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import type { AxiosError } from 'axios'
import type PostDraft from '../../models/PostDraft'
import type ImproveResult from '../../models/ImproveResult'
import type GenerateImageResult from '../../models/GenerateImageResult'
import { IMPROVE_STYLES, IMPROVE_STYLE_LABELS } from '../../models/ImproveStyle'
import type { ImproveStyle } from '../../models/ImproveStyle'
import useService from '../../../hooks/use-service'
import ProfileService from '../../../services/auth-aware/ProfileService'
import UploadsService from '../../../services/auth-aware/UploadsService'
import DraftsService from '../../../services/auth-aware/DraftsService'
import SpinnerButton from '../../common/spinner-button/SpinnerButton'
import ContentGuidelinesModal from '../../common/content-guidelines/ContentGuidelinesModal'
import InlineToast from '../../common/inline-toast/InlineToast'
import type { InlineToastTone } from '../../common/inline-toast/InlineToast'
import { validateImageFile, validateImageUrl } from '../../../utils/image-validator'
import { useAppDispatch } from '../../../redux/hooks'
import { add } from '../../../redux/profile-slice'
import './NewPost.css'

type ImageMode = 'none' | 'url' | 'file'

export default function NewPost() {
    const dispatch = useAppDispatch()
    const profileService = useService(ProfileService);
    const uploadsService = useService(UploadsService);
    const draftsService = useService(DraftsService);
    const { register, handleSubmit, reset, setValue, getValues, formState } = useForm<PostDraft>()
    const [imageMode, setImageMode] = useState<ImageMode>('none')
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [improveResult, setImproveResult] = useState<ImproveResult | null>(null)
    const [improveStyle, setImproveStyle] = useState<ImproveStyle>('professional')
    const [isImproving, setIsImproving] = useState(false)
    const [generatedImage, setGeneratedImage] = useState<GenerateImageResult | null>(null)
    const [isGeneratingImage, setIsGeneratingImage] = useState(false)
    const [isAiGeneratedImage, setIsAiGeneratedImage] = useState(false)
    const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false)
    const [moderationToast, setModerationToast] = useState<{ message: string; tone: InlineToastTone } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    function showModerationToast(message: string, tone: InlineToastTone = 'info') {
        setModerationToast({ message, tone })
    }

    function handleImageModeChange(mode: ImageMode) {
        setImageMode(mode)
        setImageFile(null)
        setImagePreview(null)
        setIsAiGeneratedImage(false)
        setValue('imageUrl', undefined)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        const err = validateImageFile(file)
        if (err) {
            alert(err)
            if (fileInputRef.current) fileInputRef.current.value = ''
            return
        }
        setImageFile(file)
        setImagePreview(URL.createObjectURL(file))
    }

    async function handleGenerateImage() {
        const title = getValues('title')
        const body = getValues('body')
        if (!title?.trim()) return
        const prompt = body?.trim() ? `${title}\n\n${body}` : title
        setIsGeneratingImage(true)
        try {
            const result = await draftsService.generateImage(prompt)
            setGeneratedImage(result)
        } catch (e) {
            const msg = (e as AxiosError<{ message: string }>).response?.data?.message ?? (e as Error).message ?? 'Failed to generate image'
            alert(msg)
        } finally {
            setIsGeneratingImage(false)
        }
    }

    function handleUseGeneratedImage() {
        if (!generatedImage) return
        setImageMode('url')
        setValue('imageUrl', generatedImage.url)
        setImagePreview(generatedImage.url)
        setIsAiGeneratedImage(true)
        setGeneratedImage(null)
    }

    async function handleImprove() {
        const body = getValues('body')
        if (!body?.trim()) return
        setIsImproving(true)
        try {
            const result = await draftsService.improve(body, improveStyle)
            setImproveResult(result)
        } catch (e) {
            const msg = (e as AxiosError<{ message: string }>).response?.data?.message ?? (e as Error).message ?? 'Failed to improve text'
            alert(msg)
        } finally {
            setIsImproving(false)
        }
    }

    function handlePickVersion(version: 'original' | 'improved') {
        if (!improveResult) return
        setValue('body', version === 'original' ? improveResult.original : improveResult.improved)
        setImproveResult(null)
    }

    async function createPost(draft: PostDraft) {
        if (imageMode === 'url' && draft.imageUrl && !isAiGeneratedImage) {
            const err = validateImageUrl(draft.imageUrl)
            if (err) { alert(err); return }
        }
        try {
            const profanity = await draftsService.checkProfanity({
                title: draft.title,
                body: draft.body,
            })
            if (profanity.action === 'hard_block' || profanity.hasProfanity) {
                showModerationToast(profanity.userMessage ?? `Profanity detected${profanity.reasons.length ? `: ${profanity.reasons.join(', ')}` : ''}`, 'error')
                return
            }
            if (profanity.action === 'soft_filter') {
                showModerationToast(profanity.userMessage ?? 'Some language was automatically filtered to match our community guidelines.', 'warning')
            }
            if (profanity.appendMedicalCommunityNote) {
                showModerationToast('A medical community note will be added automatically to this post.', 'info')
            }
            if (profanity.monitorCryptoSpam || profanity.requiresReview) {
                showModerationToast('This post may be placed under additional automated crypto-safety monitoring.', 'warning')
            }

            let newPost
            if (imageMode === 'file' && imageFile) {
                const imageUrl = await uploadsService.uploadFile(imageFile, 'post-image')
                newPost = await profileService.createPost({ ...draft, imageUrl })
            } else {
                newPost = await profileService.createPost(draft)
            }
            dispatch(add(newPost))
            reset()
            setImageMode('none')
            setImageFile(null)
            setImagePreview(null)
            setImproveResult(null)
            setGeneratedImage(null)
            setIsAiGeneratedImage(false)
            setModerationToast(null)
        } catch (e) {
            alert(e)
        }
    }

    return (
        <div className="new-post">
            <form className="new-post-form" onSubmit={handleSubmit(createPost)}>
                <h3 className="new-post-title">Create New Post</h3>
                <p className="new-post-guidelines">
                    Please follow our{' '}
                    <button type="button" className="new-post-guidelines-link" onClick={() => setIsGuidelinesOpen(true)}>
                        Content Guidelines
                    </button>
                    .
                </p>
                {moderationToast && (
                    <InlineToast
                        message={moderationToast.message}
                        tone={moderationToast.tone}
                        onClose={() => setModerationToast(null)}
                    />
                )}
                <input
                    className="new-post-input"
                    type="text"
                    placeholder="Enter your title"
                    {...register('title', { required: { value: true, message: 'Title is required' }, minLength: { value: 10, message: 'Title must be at least 10 characters' } })}
                />
                <div className="error">{formState.errors.title?.message}</div>
                <textarea
                    className="new-post-textarea"
                    placeholder="What do you want to share today?"
                    rows={5}
                    {...register('body', { required: { value: true, message: 'Body is required' }, minLength: { value: 20, message: 'Body must be at least 20 characters' } })}
                />
                <div className="error">{formState.errors.body?.message}</div>
                <div className="new-post-improve-styles">
                    {IMPROVE_STYLES.map(s => (
                        <button key={s} type="button"
                            className={`new-post-improve-style-btn${improveStyle === s ? ' new-post-improve-style-btn--active' : ''}`}
                            onClick={() => setImproveStyle(s)}>
                            {IMPROVE_STYLE_LABELS[s]}
                        </button>
                    ))}
                </div>
                <SpinnerButton
                    className="new-post-improve-btn"
                    type="button"
                    label="✨ Improve with AI"
                    loadingLabel="Improving..."
                    isLoading={isImproving}
                    onClick={handleImprove}
                />
                {improveResult && (
                    <div className="new-post-improve-picker">
                        <div className="new-post-improve-option">
                            <div className="new-post-improve-option-label">Original</div>
                            <div className="new-post-improve-option-text">{improveResult.original}</div>
                            <button type="button" className="new-post-improve-select-btn" onClick={() => handlePickVersion('original')}>Use Original</button>
                        </div>
                        <div className="new-post-improve-option new-post-improve-option--ai">
                            <div className="new-post-improve-option-label">✨ AI Improved</div>
                            <div className="new-post-improve-option-text">{improveResult.improved}</div>
                            <button type="button" className="new-post-improve-select-btn new-post-improve-select-btn--ai" onClick={() => handlePickVersion('improved')}>Use Improved</button>
                        </div>
                    </div>
                )}

                <div className="new-post-image-section">
                    <div className="new-post-image-actions">
                        <button type="button" className={`new-post-image-action-btn${imageMode === 'url' ? ' active' : ''}`} onClick={() => handleImageModeChange(imageMode === 'url' ? 'none' : 'url')}>Add image URL</button>
                        <button type="button" className={`new-post-image-action-btn${imageMode === 'file' ? ' active' : ''}`} onClick={() => handleImageModeChange(imageMode === 'file' ? 'none' : 'file')}>Upload image</button>
                        <SpinnerButton
                            className="new-post-generate-image-btn"
                            type="button"
                            label="🎨 Generate with AI"
                            loadingLabel="Generating..."
                            isLoading={isGeneratingImage}
                            onClick={handleGenerateImage}
                        />
                    </div>
                    {generatedImage && (
                        <div className="new-post-generated-image">
                            <img className="new-post-image-preview" src={generatedImage.url} alt="AI generated" />
                            <div className="new-post-generated-image-prompt">🎨 {generatedImage.revisedPrompt}</div>
                            <div className="new-post-generated-image-actions">
                                <button type="button" className="new-post-generate-use-btn" onClick={handleUseGeneratedImage}>Use this image</button>
                                <button type="button" className="new-post-generate-discard-btn" onClick={() => setGeneratedImage(null)}>Discard</button>
                            </div>
                        </div>
                    )}
                    {imageMode === 'url' && (
                        <input
                            className="new-post-input"
                            type="url"
                            placeholder="https://example.com/image.jpg"
                            {...register('imageUrl')}
                        />
                    )}
                    {imageMode === 'file' && (
                        <input
                            ref={fileInputRef}
                            className="new-post-file-input"
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    )}
                    {imagePreview && (
                        <img className="new-post-image-preview" src={imagePreview} alt="Preview" />
                    )}
                </div>

                <SpinnerButton className="new-post-submit" type="submit" label="Add new post" loadingLabel="Adding post..." isLoading={formState.isSubmitting} />
            </form>
            {isGuidelinesOpen && <ContentGuidelinesModal onClose={() => setIsGuidelinesOpen(false)} />}
        </div>
    )
}