import axios from 'axios';
import type PostComment from '../components/models/PostComment';
import type PostCommentDraft from '../components/models/PostCommentDraft';

class CommentsService {
    async addComment(postId: string, draft: PostCommentDraft): Promise<PostComment> {
        const { data } = await axios.post<PostComment>(
            `${import.meta.env.VITE_API_URL}/comments/${postId}`,
            draft
        );
        return data;
    }

    async updateComment(_postId: string, commentId: string, draft: PostCommentDraft): Promise<PostComment> {
        const { data } = await axios.patch<PostComment>(
            `${import.meta.env.VITE_API_URL}/comments/${commentId}`,
            draft
        );
        return data;
    }

    async deleteComment(_postId: string, commentId: string): Promise<void> {
        await axios.delete(`${import.meta.env.VITE_API_URL}/comments/${commentId}`);
    }
}

const commentsService = new CommentsService();
export default commentsService;
