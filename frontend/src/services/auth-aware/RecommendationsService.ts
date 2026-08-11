import type SuggestedUser from '../../components/models/SuggestedUser';
import AuthAwareService from './AuthAware';

export default class RecommendationsService extends AuthAwareService {
    async getSuggestedUsers(topic?: string): Promise<SuggestedUser[]> {
        const { data } = await this.axiosInstance.get<SuggestedUser[]>(`${import.meta.env.VITE_RECOMMENDATION_URL}/recommendations/suggested-users`, {
            params: topic ? { topic } : undefined,
        });
        return data;
    }
}
