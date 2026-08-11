import type User from '../../components/models/User';
import AuthAwareService from './AuthAware';

export default class FollowingService extends AuthAwareService {
    async getFollowing(): Promise<User[]> {
        const { data } = await this.axiosInstance.get<User[]>(`${import.meta.env.VITE_API_URL}/follows/following`);
        return data;
    }
 
    async getFollowingOf(userId: string): Promise<User[]> {
        const { data } = await this.axiosInstance.get<User[]>(`${import.meta.env.VITE_API_URL}/follows/following/${userId}`);
        return data;
    }

    async follow(userId: string): Promise<void> {
        await this.axiosInstance.post(`${import.meta.env.VITE_API_URL}/follows/follow/${userId}`);
    }

    async unfollow(userId: string): Promise<void> {
        await this.axiosInstance.post(`${import.meta.env.VITE_API_URL}/follows/unfollow/${userId}`);
    }
}
