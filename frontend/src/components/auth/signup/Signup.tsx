import { useContext, useRef, useState } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import authService from '../../../services/auth';
import AuthContext from '../auth/AuthContext';
import SpinnerButton from '../../common/spinner-button/SpinnerButton';
import useService from '../../../hooks/use-service';
import DraftsService from '../../../services/auth-aware/DraftsService';
import { validateImageFile } from '../../../utils/image-validator';
import UploadsService from '../../../services/auth-aware/UploadsService';
import ProfileService from '../../../services/auth-aware/ProfileService';
import './Signup.css';

interface SignupProps {
    onLogin: () => void;
}

interface SignupForm {
    name: string;
    username: string;
    password: string;
    avatarUrl: string;
}

export default function SignupForm({ onLogin }: SignupProps) {
    const { saveJwt } = useContext(AuthContext)!;
    const draftsService = useService(DraftsService);
    const { register, handleSubmit, formState, setError, reset, setValue } = useForm<SignupForm>();

    const [avatarMode, setAvatarMode] = useState<'none' | 'url' | 'file'>('none');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
    const [avatarPrompt, setAvatarPrompt] = useState('');
    const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    function switchAvatarMode(mode: 'url' | 'file') {
        const next = avatarMode === mode ? 'none' : mode;
        setAvatarMode(next);
        setAvatarFile(null);
        setAvatarPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const err = validateImageFile(file);
        if (err) {
            alert(err);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        setAvatarFile(file);
        setAvatarPreviewUrl(URL.createObjectURL(file));
        setAvatarPrompt('');
        setAvatarMode('file');
        setValue('avatarUrl', '');
    }

    async function handleGenerateAvatar() {
        const prompt = avatarPrompt.trim();
        if (!prompt) return;
        setIsGeneratingAvatar(true);
        try {
            const result = await draftsService.generateAvatar(prompt);
            setAvatarMode('url');
            setAvatarFile(null);
            setAvatarPreviewUrl(result.url);
            setValue('avatarUrl', result.url);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (e) {
            const message = axios.isAxiosError(e)
                ? (e.response?.data?.message ?? e.message)
                : e instanceof Error
                    ? e.message
                    : 'Failed to generate avatar';
            alert(message);
        } finally {
            setIsGeneratingAvatar(false);
        }
    }

    function handleLoginClick() {
        reset();
        setAvatarMode('none');
        setAvatarFile(null);
        setAvatarPreviewUrl(null);
        setAvatarPrompt('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        onLogin();
    }

    async function signup(data: SignupForm) {
        try {
            const payload: { name: string; username: string; password: string; avatarUrl?: string } = {
                name: data.name,
                username: data.username,
                password: data.password,
            };
            if (avatarMode === 'url' && data.avatarUrl) {
                payload.avatarUrl = data.avatarUrl;
            }

            const { jwt: initialJwt } = await authService.signup(payload);

            if (avatarMode === 'file' && avatarFile) {
                try {
                    const authedAxios = axios.create({ headers: { Authorization: `Bearer ${initialJwt}` } });
                    const uploadsService = new UploadsService(authedAxios);
                    const profileService = new ProfileService(authedAxios);
                    const avatarUrl = await uploadsService.uploadFile(avatarFile, 'avatar');
                    const { jwt: updatedJwt } = await profileService.updateProfile({ avatarUrl });
                    saveJwt(updatedJwt);
                } catch {
                    alert('Account created but avatar upload failed. You can set your avatar from your profile.');
                    saveJwt(initialJwt);
                }
            } else {
                saveJwt(initialJwt);
            }
        } catch (e) {
            const status = (e as { response?: { status?: number } })?.response?.status;
            if (status === 409) {
                setError('username', { message: 'Username already taken' });
            } else {
                alert(e);
            }
        }
    }

    return (
        <div className='Signup'>
            <div className='signup-card'>
                <img className='signup-logo' src='/BetterX-logo.png' alt='BetterX' />
                <h2 className='signup-title'>Create your account</h2>
                <form className='signup-form' onSubmit={handleSubmit(signup)}>
                    <input
                        className='signup-input'
                        placeholder='Full name'
                        {...register('name', { required: 'Name is required' })}
                    />
                    <div className='error'>{formState.errors.name?.message}</div>

                    <div className='signup-avatar-section'>
                        {avatarPreviewUrl && (
                            <img className='signup-avatar-preview' src={avatarPreviewUrl} alt='Avatar preview' />
                        )}
                        <div className='signup-avatar-label'>Profile picture <span>(optional)</span></div>
                        <div className='signup-avatar-modes'>
                            <button
                                type='button'
                                className={`signup-avatar-mode-btn${avatarMode === 'url' ? ' active' : ''}`}
                                onClick={() => switchAvatarMode('url')}
                            >
                                From URL
                            </button>
                            <button
                                type='button'
                                className={`signup-avatar-mode-btn${avatarMode === 'file' ? ' active' : ''}`}
                                onClick={() => switchAvatarMode('file')}
                            >
                                Upload
                            </button>
                        </div>
                        {avatarMode === 'url' && (
                            <input
                                className='signup-input'
                                placeholder='https://example.com/avatar.jpg'
                                {...register('avatarUrl', {
                                    onChange: e => setAvatarPreviewUrl((e.target as HTMLInputElement).value || null),
                                })}
                            />
                        )}
                        {avatarMode === 'file' && (
                            <div className='signup-avatar-file'>
                                <input
                                    type='file'
                                    accept='image/*'
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                />
                                {avatarFile && <span className='signup-avatar-filename'>{avatarFile.name}</span>}
                            </div>
                        )}
                        <textarea
                            className='signup-input'
                            style={{ minHeight: 90 }}
                            placeholder='Describe the avatar you want, then generate it with AI...'
                            value={avatarPrompt}
                            onChange={e => setAvatarPrompt(e.target.value)}
                        />
                        <SpinnerButton
                            className='signup-button'
                            type='button'
                            label='Generate avatar with AI'
                            loadingLabel='Generating...'
                            isLoading={isGeneratingAvatar}
                            onClick={handleGenerateAvatar}
                        />
                    </div>

                    <input
                        className='signup-input'
                        placeholder='Username'
                        autoComplete='off'
                        {...register('username', { required: 'Username is required', minLength: { value: 6, message: 'Username must be at least 6 characters' } })}
                    />
                    <div className='error'>{formState.errors.username?.message}</div>
                    <input
                        className='signup-input'
                        type='password'
                        placeholder='Password'
                        autoComplete='new-password'
                        {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Password must be at least 6 characters' } })}
                    />
                    <div className='error'>{formState.errors.password?.message}</div>
                    <SpinnerButton className='signup-button' type='submit' label='Sign up' loadingLabel='Signing up...' isLoading={formState.isSubmitting} />
                </form>
                <div className='signup-footer'>
                    <span>Already have an account?</span>
                    <button className='signup-link' type='button' onClick={handleLoginClick}>Log in</button>
                </div>
            </div>
        </div>
    );
}
