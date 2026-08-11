import { useContext, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import AuthContext from '../../auth/auth/AuthContext';
import useService from '../../../hooks/use-service';
import ProfileService from '../../../services/auth-aware/ProfileService';
import UploadsService from '../../../services/auth-aware/UploadsService';
import DraftsService from '../../../services/auth-aware/DraftsService';
import { getAvatar } from '../../../utils/avatar';
import SpinnerButton from '../../common/spinner-button/SpinnerButton';
import type User from '../../models/User';
import { useAppDispatch } from '../../../redux/hooks';
import { updateUser as updateProfileUser } from '../../../redux/profile-slice';
import { updateUser as updateFeedUser } from '../../../redux/feed-slice';
import { updateUser as updateFollowersUser } from '../../../redux/followers-slice';
import { updateUser as updateFollowingUser } from '../../../redux/following-slice';
import { updateUser as updateUsersUser } from '../../../redux/users-slice';
import { validateImageFile } from '../../../utils/image-validator';
import './EditProfile.css';

interface EditProfileProps {
    currentUser: User;
    onClose: () => void;
}

interface EditProfileForm {
    name: string;
    username: string;
    password: string;
    confirmPassword: string;
    avatarUrl: string;
}

export default function EditProfile({ currentUser, onClose }: EditProfileProps) {
    const { saveJwt, logout } = useContext(AuthContext)!;
    const dispatch = useAppDispatch();
    const profileService = useService(ProfileService);
    const uploadsService = useService(UploadsService);
    const draftsService = useService(DraftsService);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [avatarPrompt, setAvatarPrompt] = useState('');
    const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

    const { register, handleSubmit, control, setValue, formState } = useForm<EditProfileForm>({
        defaultValues: {
            name: currentUser.name,
            username: currentUser.username,
            password: '',
            confirmPassword: '',
            avatarUrl: currentUser.avatarUrl ?? '',
        },
    });

    const watchedAvatar = useWatch({ control, name: 'avatarUrl' });

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
        setValue('avatarUrl', '');
    }

    async function handleGenerateAvatar() {
        const prompt = avatarPrompt.trim();
        if (!prompt) return;
        setIsGeneratingAvatar(true);
        try {
            const result = await draftsService.generateAvatar(prompt);
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

    async function onSubmit(values: EditProfileForm) {
        if (values.password && values.password !== values.confirmPassword) {
            alert('Passwords do not match.');
            return;
        }
        try {
            const payload: { name?: string; username?: string; password?: string; avatarUrl?: string | null } = {};
            if (values.name !== currentUser.name) payload.name = values.name;
            if (values.username !== currentUser.username) payload.username = values.username;
            if (values.password) payload.password = values.password;

            if (avatarFile) {
                payload.avatarUrl = await uploadsService.uploadFile(avatarFile, 'avatar');
            } else if (values.avatarUrl !== (currentUser.avatarUrl ?? '')) {
                payload.avatarUrl = values.avatarUrl || null;
            }

            if (Object.keys(payload).length === 0) {
                onClose();
                return;
            }

            const { jwt } = await profileService.updateProfile(payload);
            saveJwt(jwt);
            const updatedUser = jwtDecode<User>(jwt);
            dispatch(updateProfileUser(updatedUser));
            dispatch(updateFeedUser(updatedUser));
            dispatch(updateFollowersUser(updatedUser));
            dispatch(updateFollowingUser(updatedUser));
            dispatch(updateUsersUser(updatedUser));
            onClose();
        } catch (e) {
            alert(e);
        }
    }

    async function handleDeleteAccount() {
        if (!confirm('Are you sure you want to delete your account? This will permanently delete all your posts. Your comments on others\' posts will remain but will be shown as from a deleted user.')) return;
        if (!confirm('This action cannot be undone. Delete account?')) return;
        try {
            await profileService.deleteProfile();
            logout();
        } catch (e) {
            alert(e);
        }
    }

    return (
        <div className="edit-profile-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="edit-profile-modal">
                <h2 className="edit-profile-title">Edit Profile</h2>

                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="edit-profile-field">
                        <label className="edit-profile-label">Name</label>
                        <input
                            className="edit-profile-input"
                            {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Min 2 characters' } })}
                        />
                        {formState.errors.name && <span className="edit-profile-error">{formState.errors.name.message}</span>}
                    </div>

                    <div className="edit-profile-field" style={{ marginTop: 10 }}>
                        <label className="edit-profile-label">Username</label>
                        <input
                            className="edit-profile-input"
                            {...register('username', { required: 'Username is required', minLength: { value: 3, message: 'Min 3 characters' } })}
                        />
                        {formState.errors.username && <span className="edit-profile-error">{formState.errors.username.message}</span>}
                    </div>

                    <div className="edit-profile-field" style={{ marginTop: 10 }}>
                        <label className="edit-profile-label">New Password <span style={{ fontWeight: 400 }}>(leave blank to keep current)</span></label>
                        <input
                            className="edit-profile-input"
                            type="password"
                            autoComplete="new-password"
                            {...register('password', { minLength: { value: 6, message: 'Min 6 characters' } })}
                        />
                        {formState.errors.password && <span className="edit-profile-error">{formState.errors.password.message}</span>}
                    </div>

                    <div className="edit-profile-field" style={{ marginTop: 10 }}>
                        <label className="edit-profile-label">Confirm New Password</label>
                        <input
                            className="edit-profile-input"
                            type="password"
                            autoComplete="new-password"
                            {...register('confirmPassword')}
                        />
                    </div>

                    <div className="edit-profile-field" style={{ marginTop: 10 }}>
                        <label className="edit-profile-label">Profile Picture <span style={{ fontWeight: 400 }}>(URL or upload from device)</span></label>
                        <input type="hidden" {...register('avatarUrl')} />
                        {!avatarFile && (
                            <input
                                className="edit-profile-input"
                                placeholder="https://... (or upload below)"
                                value={watchedAvatar ?? ''}
                                onChange={(e) => setValue('avatarUrl', e.target.value)}
                            />
                        )}
                        {avatarFile && (
                            <span className="edit-profile-filename">{avatarFile.name}</span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: 6 }}>
                            <button
                                type="button"
                                className="edit-profile-upload-button"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                Upload from device
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={handleFileChange}
                            />
                            {(watchedAvatar || avatarFile) && (
                                <button
                                    type="button"
                                    className="edit-profile-clear-button"
                                    onClick={() => {
                                        setValue('avatarUrl', '');
                                        setAvatarFile(null);
                                        setAvatarPreviewUrl(null);
                                        setAvatarPrompt('');
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }}
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <textarea
                            className="edit-profile-input"
                            style={{ minHeight: 90, marginTop: 10 }}
                            placeholder="Describe the avatar you want, then generate it with AI..."
                            value={avatarPrompt}
                            onChange={e => setAvatarPrompt(e.target.value)}
                        />
                        <SpinnerButton
                            className="edit-profile-upload-button"
                            type="button"
                            label="Generate avatar with AI"
                            loadingLabel="Generating..."
                            isLoading={isGeneratingAvatar}
                            onClick={handleGenerateAvatar}
                        />
                        <img
                            className="edit-profile-avatar-preview"
                            src={avatarPreviewUrl ?? getAvatar(watchedAvatar || null)}
                            alt="Avatar preview"
                            onError={e => { (e.target as HTMLImageElement).src = getAvatar(); }}
                        />
                    </div>

                    <div className="edit-profile-actions" style={{ marginTop: 16 }}>
                        <SpinnerButton
                            className="edit-profile-save-button"
                            type="submit"
                            label="Save Changes"
                            loadingLabel="Saving..."
                            isLoading={formState.isSubmitting}
                        />
                        <button className="edit-profile-cancel-button" type="button" onClick={onClose}>
                            Cancel
                        </button>
                    </div>
                </form>

                <hr className="edit-profile-divider" />

                <button className="edit-profile-delete-button" type="button" onClick={handleDeleteAccount}>
                    Delete Account
                </button>
            </div>
        </div>
    );
}
