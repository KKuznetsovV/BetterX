import { configureStore } from "@reduxjs/toolkit";
import followingSlice from "./following-slice";
import followersSlice from "./followers-slice";
import profileSlice from "./profile-slice";
import feedSlice from "./feed-slice";
import usersSlice from "./users-slice";
import viewedFollowsSlice from "./viewed-follows-slice";
import notificationsSlice from "./notifications-slice";

const store = configureStore({
    reducer: {
        followingSlice,
        followersSlice,
        profileSlice,
        feedSlice,
        usersSlice,
        viewedFollowsSlice,
        notificationsSlice,
    },
});

export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;