import { Transaction } from 'sequelize'
import { enqueueEvent } from '../mq/outbox'

interface ActorSnapshot {
    id: string
    name: string
    username: string
    avatarUrl: string | null
}

// Enqueued (not published directly) in the SAME transaction as the Follow
// write - see mq/outbox.ts for why.
export async function enqueueFollowCreatedEvent(transaction: Transaction, payload: {
    recipientId: string
    actor?: ActorSnapshot | null
}): Promise<void> {
    await enqueueEvent(transaction, 'follow.created', payload)
}
