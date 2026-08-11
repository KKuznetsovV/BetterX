// describe slice schema

import type User from "../components/models/User";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { resetAll } from './reset-action';
interface FollowingState {
    following: User[];
}

const initialState: FollowingState = {
    following: [],
};

export const followingSlice = createSlice({
    name: "following",
    initialState,
    reducers: {
        populate: (state, action: PayloadAction<User[]>) => {
            state.following = action.payload;
        },
        follow: (state, action: PayloadAction<User>) => {
            state.following.push(action.payload);
        },
        unfollow: (state, action: PayloadAction<{ id: string }>) => {
            state.following = state.following.filter(user => user.id !== action.payload.id);
        },
        updateUser: (state, action: PayloadAction<{ id: string; name: string; username: string; avatarUrl?: string | null }>) => {
            const u = state.following.find(u => u.id === action.payload.id);
            if (u) { u.name = action.payload.name; u.username = action.payload.username; u.avatarUrl = action.payload.avatarUrl; }
        },
    },
    extraReducers: (builder) => {
        builder.addCase(resetAll, () => initialState);
    },
});

export const { populate, follow, unfollow, updateUser } = followingSlice.actions;
export default followingSlice.reducer;