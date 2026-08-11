import type User from '../../components/models/User';
import AuthAwareService from './AuthAware';

export default class UsersService extends AuthAwareService {
    async getUsers(): Promise<User[]> {
        const { data } = await this.axiosInstance.get<User[]>(`${import.meta.env.VITE_API_URL}/users`);
        return data;
    }
}
