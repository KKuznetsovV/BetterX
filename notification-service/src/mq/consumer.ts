import { connectWithRetry, EVENTS_EXCHANGE } from './rabbitmq'
import { persistAndBroadcastNotification } from '../controllers/notifications/controller'
import { fetchFollowerIds } from '../identity/identity-client'

const QUEUE = 'notification-service.events'
const ROUTING_KEYS = ['post.created', 'comment.created', 'follow.created']

interface ActorSnapshot {
    id: string
    name: string
    username: string
    avatarUrl: string | null
}

async function handleEvent(routingKey: string, payload: Record<string, unknown>): Promise<void> {
    switch (routingKey) {
        case 'post.created': {
            const actor = payload.actor as ActorSnapshot | null
            const postId = payload.postId as string
            if (!actor) return
            const followerIds = await fetchFollowerIds(actor.id)
            for (const recipientId of followerIds) {
                if (recipientId === actor.id) continue
                await persistAndBroadcastNotification({ recipientId, actor, type: 'post', postId })
            }
            break
        }
        case 'comment.created':
            await persistAndBroadcastNotification({
                recipientId: payload.recipientId as string,
                actor: payload.actor as ActorSnapshot | null,
                type: 'comment',
                postId: payload.postId as string,
                commentId: payload.commentId as string,
            })
            break
        case 'follow.created':
            await persistAndBroadcastNotification({
                recipientId: payload.recipientId as string,
                actor: payload.actor as ActorSnapshot | null,
                type: 'follow',
            })
            break
        default:
            console.error('Received event with unknown routing key:', routingKey)
    }
}

// Starts (and, on a dropped connection, restarts) the durable queue consumer
// bound to every domain event this service cares about. A slow/unreachable
// RabbitMQ at startup must never crash the service - connectWithRetry blocks
// this call, not app.listen().
export async function startEventConsumer(): Promise<void> {
    const connection = await connectWithRetry()
    const channel = await connection.createChannel()
    await channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true })
    await channel.assertQueue(QUEUE, { durable: true })
    for (const routingKey of ROUTING_KEYS) {
        await channel.bindQueue(QUEUE, EVENTS_EXCHANGE, routingKey)
    }

    await channel.consume(QUEUE, (msg) => {
        if (!msg) return
        void (async () => {
            try {
                const payload = JSON.parse(msg.content.toString())
                await handleEvent(msg.fields.routingKey, payload)
                channel.ack(msg)
            } catch (e) {
                console.error('Failed to process event', msg.fields.routingKey, e)
                // No dead-letter queue yet (added with the transactional
                // outbox step) - drop rather than requeue-loop forever.
                channel.nack(msg, false, false)
            }
        })()
    })

    connection.on('close', () => {
        console.error('RabbitMQ connection closed, restarting event consumer...')
        void startEventConsumer()
    })
    connection.on('error', (e: Error) => {
        console.error('RabbitMQ connection error:', e.message)
    })

    console.log(`notification-service is consuming events from queue "${QUEUE}"`)
}
