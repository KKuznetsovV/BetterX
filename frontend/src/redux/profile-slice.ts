import type PostModel from '../components/models/Post';
import type PostComment from '../components/models/PostComment';
import type Like from '../components/models/Like';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { resetAll } from './reset-action';

interface ProfileState {
    posts: PostModel[];
}

const initialState: ProfileState = {
    posts: [],
};

const profileSlice = createSlice({
    name: 'profile',
    initialState,
    reducers: {
        populate: (state, action: PayloadAction<PostModel[]>) => {
            const sorted = [...action.payload].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            sorted.forEach(post => {
                post.comments = [...post.comments].sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
            });
            state.posts = sorted;
        },
        add: (state, action: PayloadAction<PostModel>) => {
            state.posts.unshift(action.payload);
        },
        remove: (state, action: PayloadAction<{ id: string }>) => {
            state.posts = state.posts.filter(p => p.id !== action.payload.id);
        },
        addComment: (state, action: PayloadAction<PostComment>) => {
            const post = state.posts.find(p => p.id === action.payload.postId)
            if (!post) return
            if (post.comments.some(c => c.id === action.payload.id)) return
            post.comments.unshift(action.payload)
        },
        updateComment: (state, action: PayloadAction<PostComment>) => {
            const post = state.posts.find(p => p.id === action.payload.postId)
            if (post) {
                const idx = post.comments.findIndex(c => c.id === action.payload.id)
                if (idx !== -1) post.comments[idx] = action.payload
            }
        },
        removeComment: (state, action: PayloadAction<{ id: string; postId: string }>) => {
            const post = state.posts.find(p => p.id === action.payload.postId)
            if (post) post.comments = post.comments.filter(c => c.id !== action.payload.id)
        },
        update: (state, action: PayloadAction<{ id: string; title: string; body: string; imageUrl?: string | null }>) => {
            const post = state.posts.find(p => p.id === action.payload.id);
            if (post) {
                post.title = action.payload.title;
                post.body = action.payload.body;
                if ('imageUrl' in action.payload) post.imageUrl = action.payload.imageUrl ?? null;
            }
        },
        updateUser: (state, action: PayloadAction<{ id: string; name: string; username: string; avatarUrl?: string | null }>) => {
            state.posts.forEach(post => {
                if (post.user?.id === action.payload.id) {
                    post.user.name = action.payload.name;
                    post.user.username = action.payload.username;
                    post.user.avatarUrl = action.payload.avatarUrl;
                }
                post.comments.forEach(comment => {
                    if (comment.user?.id === action.payload.id) {
                        comment.user.name = action.payload.name;
                        comment.user.username = action.payload.username;
                        comment.user.avatarUrl = action.payload.avatarUrl;
                    }
                });
            });
        },
        addLike: (state, action: PayloadAction<Like>) => {
            const like = action.payload
            for (const post of state.posts) {
                if (like.postId && post.id === like.postId) {
                    if (!post.likes) post.likes = []
                    const idx = post.likes.findIndex(l => l.userId === like.userId)
                    if (idx !== -1) post.likes[idx] = like
                    else post.likes.push(like)
                    return
                }
                for (const comment of post.comments) {
                    if (like.commentId && comment.id === like.commentId) {
                        if (!comment.likes) comment.likes = []
                        const idx = comment.likes.findIndex(l => l.userId === like.userId)
                        if (idx !== -1) comment.likes[idx] = like
                        else comment.likes.push(like)
                        return
                    }
                }
            }
        },
        removeLike: (state, action: PayloadAction<{ userId: string; postId?: string; commentId?: string }>) => {
            const { userId, postId, commentId } = action.payload
            for (const post of state.posts) {
                if (postId && post.id === postId) {
                    post.likes = (post.likes ?? []).filter(l => l.userId !== userId)
                    return
                }
                for (const comment of post.comments) {
                    if (commentId && comment.id === commentId) {
                        comment.likes = (comment.likes ?? []).filter(l => l.userId !== userId)
                        return
                    }
                }
            }
        },
    },
    extraReducers: (builder) => {
        builder.addCase(resetAll, () => initialState);
    },
});

export const { populate, add, remove, addComment, updateComment, removeComment, update, updateUser, addLike, removeLike } = profileSlice.actions;
export default profileSlice.reducer;
