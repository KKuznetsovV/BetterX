import type User from './User'

export default interface Like {
    id: string
    userId: string
    postId: string | null
    commentId: string | null
    emoji: string
    createdAt: string
    user?: User | null
}
