import type User from '../../components/models/User';
import AuthAwareService from './AuthAware';

export default class FollowersService extends AuthAwareService {
    async getFollowers(): Promise<User[]> {
        const { data } = await this.axiosInstance.get<User[]>(`${import.meta.env.VITE_API_URL}/follows/followers`);
        return data;
    }

    async getFollowersOf(userId: string): Promise<User[]> {
        const { data } = await this.axiosInstance.get<User[]>(`${import.meta.env.VITE_API_URL}/follows/followers/${userId}`);
        return data;
    }
}
