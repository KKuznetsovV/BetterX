import type Like from '../../components/models/Like'
import AuthAwareService from './AuthAware'

export default class LikesService extends AuthAwareService {
    async likePost(postId: string, emoji: string): Promise<Like> {
        const { data } = await this.axiosInstance.post<Like>(`${import.meta.env.VITE_ENGAGEMENT_URL}/likes/post/${postId}`, { emoji })
        return data
    }
    async unlikePost(postId: string): Promise<void> {
        await this.axiosInstance.delete(`${import.meta.env.VITE_ENGAGEMENT_URL}/likes/post/${postId}`)
    }
    async likeComment(commentId: string, emoji: string): Promise<Like> {
        const { data } = await this.axiosInstance.post<Like>(`${import.meta.env.VITE_ENGAGEMENT_URL}/likes/comment/${commentId}`, { emoji })
        return data
    }
    async unlikeComment(commentId: string): Promise<void> {
        await this.axiosInstance.delete(`${import.meta.env.VITE_ENGAGEMENT_URL}/likes/comment/${commentId}`)
    }
}
