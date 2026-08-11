import type User from './User'
import type Like from './Like'

export default interface PostComment {
    id: string
    postId: string
    userId: string | null
    parentId: string | null
    body: string
    createdAt: string
    updatedAt: string
    user?: User | null
    replies?: PostComment[]
    likes: Like[]
}