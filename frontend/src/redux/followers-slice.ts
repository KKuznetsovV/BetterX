import type User from '../components/models/User';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { resetAll } from './reset-action';

interface FollowersState {
    followers: User[];
}

const initialState: FollowersState = {
    followers: [],
};

const followersSlice = createSlice({
    name: 'followers',
    initialState,
    reducers: {
        populate: (state, action: PayloadAction<User[]>) => {
            state.followers = action.payload;
        },
        addFollower: (state, action: PayloadAction<User>) => {
            state.followers.push(action.payload);
        },
        removeFollower: (state, action: PayloadAction<{ id: string }>) => {
            state.followers = state.followers.filter(u => u.id !== action.payload.id);
        },
        updateUser: (state, action: PayloadAction<{ id: string; name: string; username: string; avatarUrl?: string | null }>) => {
            const u = state.followers.find(u => u.id === action.payload.id);
            if (u) { u.name = action.payload.name; u.username = action.payload.username; u.avatarUrl = action.payload.avatarUrl; }
        },
    },
    extraReducers: (builder) => {
        builder.addCase(resetAll, () => initialState);
    },
});

export const { populate, addFollower, removeFollower, updateUser } = followersSlice.actions;
export default followersSlice.reducer;
