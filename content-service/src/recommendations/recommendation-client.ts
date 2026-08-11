import { Transaction } from 'sequelize'
import { enqueueEvent } from '../mq/outbox'

interface EmbeddablePost {
    id: string
    userId: string
    title: string
    body: string
}

// Embeddings are a best-effort enhancement for the "suggested users to
// follow" feature. post.created already carries userId/title/body (see
// notification-client.ts) so recommendation-service's own queue embeds new
// posts off that same event; only updates/deletes need their own routing key
// here. Events are enqueued (not published directly) in the SAME transaction
// as the Post write - see mq/outbox.ts for why.
export async function enqueuePostUpdatedEvent(transaction: Transaction, post: EmbeddablePost): Promise<void> {
    await enqueueEvent(transaction, 'post.updated', { postId: post.id, userId: post.userId, title: post.title, body: post.body })
}

export async function enqueuePostDeletedEvent(transaction: Transaction, postId: string): Promise<void> {
    await enqueueEvent(transaction, 'post.deleted', { postId })
}
