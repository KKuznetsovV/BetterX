import type PostModel from '../components/models/Post';
import type PostComment from '../components/models/PostComment';
import type Like from '../components/models/Like';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { follow, unfollow } from './following-slice';
import { resetAll } from './reset-action';

interface FeedState {
    feed: PostModel[];
    stale: boolean;
}

const initialState: FeedState = {
    feed: [],
    stale: false,
};

const feedSlice = createSlice({
    name: 'feed',
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
            state.feed = sorted;
            state.stale = false;
        },
        invalidate: (state) => {
            state.feed = [];
            state.stale = false;
        },
        markPending: (state) => {
            state.stale = true;
        },
        removeFromFeed: (state, action: PayloadAction<{ id: string }>) => {
            state.feed = state.feed.filter(p => p.id !== action.payload.id);
        },
        updatePost: (state, action: PayloadAction<{ id: string; title: string; body: string; imageUrl?: string | null }>) => {
            const post = state.feed.find(p => p.id === action.payload.id)
            if (post) {
                post.title = action.payload.title
                post.body = action.payload.body
                if ('imageUrl' in action.payload) post.imageUrl = action.payload.imageUrl ?? null
            }
        },
        addComment: (state, action: PayloadAction<PostComment>) => {
            const post = state.feed.find(p => p.id === action.payload.postId)
            if (!post) return
            if (post.comments.some(c => c.id === action.payload.id)) return
            post.comments.unshift(action.payload)
        },
        updateComment: (state, action: PayloadAction<PostComment>) => {
            const post = state.feed.find(p => p.id === action.payload.postId)
            if (!post) return
            const idx = post.comments.findIndex(c => c.id === action.payload.id)
            if (idx !== -1) post.comments[idx] = { ...post.comments[idx], body: action.payload.body }
        },
        removeComment: (state, action: PayloadAction<{ id: string; postId: string }>) => {
            const post = state.feed.find(p => p.id === action.payload.postId)
            if (!post) return
            post.comments = post.comments.filter(c => c.id !== action.payload.id)
        },
        updateUser: (state, action: PayloadAction<{ id: string; name: string; username: string; avatarUrl?: string | null }>) => {
            state.feed.forEach(post => {
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
            for (const post of state.feed) {
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
            for (const post of state.feed) {
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
        builder
            .addCase(follow, (state) => { state.stale = true; })
            .addCase(unfollow, (state) => { state.stale = true; })
            .addCase(resetAll, () => initialState);
    },
});

export const { populate, invalidate, markPending, removeFromFeed, updatePost, updateUser, addComment, updateComment, removeComment, addLike, removeLike } = feedSlice.actions;
export default feedSlice.reducer;
