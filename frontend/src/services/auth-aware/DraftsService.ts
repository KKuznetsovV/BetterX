import type ImproveResult from '../../components/models/ImproveResult';
import type GenerateImageResult from '../../components/models/GenerateImageResult';
import type ProfanityCheckResult from '../../components/models/ProfanityCheckResult';
import type { ImproveStyle } from '../../components/models/ImproveStyle';
import AuthAwareService from './AuthAware';

export default class DraftsService extends AuthAwareService {
    async improve(body: string, style: ImproveStyle): Promise<ImproveResult> {
        const { data } = await this.axiosInstance.post<ImproveResult>(`${import.meta.env.VITE_AI_URL}/drafts/improve`, { body, style });
        return data;
    }

    async generateImage(prompt: string): Promise<GenerateImageResult> {
        const { data } = await this.axiosInstance.post<GenerateImageResult>(`${import.meta.env.VITE_AI_URL}/drafts/generate-image`, { prompt });
        return data;
    }

    async generateAvatar(prompt: string): Promise<GenerateImageResult> {
        const { data } = await this.axiosInstance.post<GenerateImageResult>(`${import.meta.env.VITE_AI_URL}/drafts/generate-avatar`, { prompt });
        return data;
    }

    async checkProfanity(payload: { title?: string; body?: string; explicitContentEnabled?: boolean }): Promise<ProfanityCheckResult> {
        const { data } = await this.axiosInstance.post<ProfanityCheckResult>(`${import.meta.env.VITE_AI_URL}/drafts/check-profanity`, payload);
        return data;
    }
}
