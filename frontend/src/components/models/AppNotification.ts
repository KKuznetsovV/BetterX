import type User from './User'

export default interface AppNotification {
    id: string
    recipientId: string
    actorId: string | null
    type: 'comment' | 'follow' | 'post'
    postId: string | null
    commentId: string | null
    read: boolean
    createdAt: string
    actor?: User | null
}
