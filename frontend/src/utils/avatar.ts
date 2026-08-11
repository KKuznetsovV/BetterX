const DEFAULT_AVATAR = `${import.meta.env.VITE_AVATARS_BASE_URL}/default.avif`;

export function getAvatar(avatarUrl?: string | null): string {
    return avatarUrl ?? DEFAULT_AVATAR;
}
