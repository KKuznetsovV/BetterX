import type Post from '../../components/models/Post';
import AuthAwareService from './AuthAware';

export default class FeedService extends AuthAwareService {
    async getFeed(): Promise<Post[]> {
        const { data } = await this.axiosInstance.get<Post[]>(`${import.meta.env.VITE_API_URL}/feed`);
        return data;
    }
}
