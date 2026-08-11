import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { resetAll } from './reset-action';
import type User from '../components/models/User';

interface ViewedFollowsState {
    userId: string | null;
    followers: User[];
    following: User[];
}

const initialState: ViewedFollowsState = {
    userId: null,
    followers: [],
    following: [],
};

const viewedFollowsSlice = createSlice({
    name: 'viewedFollows',
    initialState,
    reducers: {
        setViewedFollows: (state, action: PayloadAction<{ userId: string; followers: User[]; following: User[] }>) => {
            state.userId = action.payload.userId;
            state.followers = action.payload.followers;
            state.following = action.payload.following;
        },
        setViewedFollowing: (state, action: PayloadAction<{ userId: string; following: User[] }>) => {
            if (state.userId !== action.payload.userId) {
                state.followers = [];
            }
            state.userId = action.payload.userId;
            state.following = action.payload.following;
        },
        setViewedFollowers: (state, action: PayloadAction<{ userId: string; followers: User[] }>) => {
            if (state.userId !== action.payload.userId) {
                state.following = [];
            }
            state.userId = action.payload.userId;
            state.followers = action.payload.followers;
        },
        clearViewedFollows: (state) => {
            state.userId = null;
            state.followers = [];
            state.following = [];
        },
        addViewedFollower: (state, action: PayloadAction<User>) => {
            if (!state.followers.some(u => u.id === action.payload.id)) {
                state.followers.push(action.payload);
            }
        },
        removeViewedFollower: (state, action: PayloadAction<{ id: string }>) => {
            state.followers = state.followers.filter(u => u.id !== action.payload.id);
        },
        addViewedFollowing: (state, action: PayloadAction<User>) => {
            if (!state.following.some(u => u.id === action.payload.id)) {
                state.following.push(action.payload);
            }
        },
        removeViewedFollowing: (state, action: PayloadAction<{ id: string }>) => {
            state.following = state.following.filter(u => u.id !== action.payload.id);
        },
    },
    extraReducers: (builder) => {
        builder.addCase(resetAll, () => initialState);
    },
});

export const {
    setViewedFollows,
    setViewedFollowing,
    setViewedFollowers,
    clearViewedFollows,
    addViewedFollower,
    removeViewedFollower,
    addViewedFollowing,
    removeViewedFollowing,
} = viewedFollowsSlice.actions;
export default viewedFollowsSlice.reducer;
