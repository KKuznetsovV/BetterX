import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type AppNotification from '../components/models/AppNotification'
import { resetAll } from './reset-action'

interface NotificationsState {
    items: AppNotification[]
    loaded: boolean
}

const initialState: NotificationsState = {
    items: [],
    loaded: false,
}

const notificationsSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        populate: (state, action: PayloadAction<AppNotification[]>) => {
            state.items = action.payload
            state.loaded = true
        },
        add: (state, action: PayloadAction<AppNotification>) => {
            state.items.unshift(action.payload)
        },
        markAllRead: (state) => {
            state.items.forEach(n => { n.read = true })
        },
        markOneRead: (state, action: PayloadAction<string>) => {
            const n = state.items.find(n => n.id === action.payload)
            if (n) n.read = true
        },
    },
    extraReducers: (builder) => {
        builder.addCase(resetAll, () => initialState)
    },
})

export const { populate, add, markAllRead, markOneRead } = notificationsSlice.actions
export default notificationsSlice.reducer
