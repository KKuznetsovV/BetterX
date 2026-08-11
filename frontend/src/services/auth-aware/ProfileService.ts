import type Post from '../../components/models/Post';
import type PostDraft from '../../components/models/PostDraft';
import AuthAwareService from './AuthAware';

export default class ProfileService extends AuthAwareService {
    async getProfile(): Promise<Post[]> {
        const { data } = await this.axiosInstance.get<Post[]>(`${import.meta.env.VITE_API_URL}/posts/mine`);
        return data;
    }

    async getProfileByUserId(userId: string): Promise<Post[]> {
        const { data } = await this.axiosInstance.get<Post[]>(`${import.meta.env.VITE_API_URL}/posts/user/${userId}`);
        return data;
    }

    async createPost(payload: PostDraft): Promise<Post> {
        const { data } = await this.axiosInstance.post<Post>(`${import.meta.env.VITE_API_URL}/posts`, payload);
        return data;
    }

    async updatePost(id: string, draft: PostDraft): Promise<Post> {
        const { data } = await this.axiosInstance.patch<Post>(`${import.meta.env.VITE_API_URL}/posts/${id}`, draft);
        return data;
    }

    async deletePost(id: string): Promise<void> {
        await this.axiosInstance.delete(`${import.meta.env.VITE_API_URL}/posts/${id}`);
    }

    async updateProfile(data: { name?: string; username?: string; password?: string; avatarUrl?: string | null }): Promise<{ jwt: string }> {
        const { data: result } = await this.axiosInstance.patch<{ jwt: string }>(`${import.meta.env.VITE_API_URL}/profile/account`, data);
        return result;
    }

    async deleteProfile(): Promise<void> {
        await this.axiosInstance.delete(`${import.meta.env.VITE_API_URL}/profile/account`);
    }
}
