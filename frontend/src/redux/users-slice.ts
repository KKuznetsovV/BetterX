import type User from '../components/models/User';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { resetAll } from './reset-action';

interface UsersState {
    users: User[];
}

const initialState: UsersState = {
    users: [],
};

const usersSlice = createSlice({
    name: 'users',
    initialState,
    reducers: {
        populate: (state, action: PayloadAction<User[]>) => {
            state.users = action.payload;
        },
        updateUser: (state, action: PayloadAction<{ id: string; name: string; username: string; avatarUrl?: string | null }>) => {
            const u = state.users.find(u => u.id === action.payload.id);
            if (u) { u.name = action.payload.name; u.username = action.payload.username; u.avatarUrl = action.payload.avatarUrl; }
        },
    },
    extraReducers: (builder) => {
        builder.addCase(resetAll, () => initialState);
    },
});

export const { populate, updateUser } = usersSlice.actions;
export default usersSlice.reducer;
