import { Transaction } from 'sequelize'
import { enqueueEvent } from '../mq/outbox'

interface ActorSnapshot {
    id: string
    name: string
    username: string
    avatarUrl: string | null
}

// A new post notifies every one of the author's followers - that fan-out now
// happens inside notification-service's event consumer (it resolves the
// follower list itself) instead of content-service looping N notification
// creation calls per follower. userId/title/body are only needed by
// recommendation-service's own queue (bound to this same routing key) to
// build the post's embedding - notification-service ignores them. The event
// is enqueued (not published directly) in the SAME transaction as the Post
// write - see mq/outbox.ts for why.
export async function enqueuePostCreatedEvent(transaction: Transaction, payload: {
    postId: string
    userId: string
    title: string
    body: string
    actor?: ActorSnapshot | null
}): Promise<void> {
    await enqueueEvent(transaction, 'post.created', payload)
}

export async function enqueueCommentCreatedEvent(transaction: Transaction, payload: {
    recipientId: string
    actor?: ActorSnapshot | null
    postId: string
    commentId: string
}): Promise<void> {
    await enqueueEvent(transaction, 'comment.created', payload)
}
