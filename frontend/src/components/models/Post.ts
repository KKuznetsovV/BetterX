import type PostComment from './PostComment'
import type User from './User'
import type Like from './Like'

export default interface PostModel {
    id: string
    userId: string
    title: string
    body: string
    imageUrl: string | null
    createdAt: string
    updatedAt: string
    comments: PostComment[]
    likes: Like[]
    user: User
}