import { connectWithRetry, EVENTS_EXCHANGE } from './rabbitmq'
import { deletePostEmbedding, storePostEmbedding } from '../embeddings/embeddings'

const QUEUE = 'recommendation-service.events'
const ROUTING_KEYS = ['post.created', 'post.updated', 'post.deleted']

async function handleEvent(routingKey: string, payload: Record<string, unknown>): Promise<void> {
    switch (routingKey) {
        case 'post.created':
        case 'post.updated':
            await storePostEmbedding({
                postId: payload.postId as string,
                userId: payload.userId as string,
                title: payload.title as string,
                body: payload.body as string,
            })
            break
        case 'post.deleted':
            await deletePostEmbedding(payload.postId as string)
            break
        default:
            console.error('Received event with unknown routing key:', routingKey)
    }
}

// Starts (and, on a dropped connection, restarts) the durable queue consumer
// bound to the post events this service cares about - a single post.created
// event both notifies followers (notification-service's own queue) and, via
// this queue, builds the post's embedding, so producers only publish once.
// A slow/unreachable RabbitMQ at startup must never crash this service -
// connectWithRetry blocks this call, not app.listen().
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

    console.log(`recommendation-service is consuming events from queue "${QUEUE}"`)
}
