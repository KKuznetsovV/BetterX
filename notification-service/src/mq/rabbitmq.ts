import config from 'config'
import amqp from 'amqplib'

export const EVENTS_EXCHANGE = 'betterx.events'

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>

// Unlike the publisher-side services (content/identity-service), the
// consumer needs a connection up-front at startup, not lazily - so this
// retries with a bounded backoff instead of connecting on first use (same
// bounded-retry shape as recommendation-service's startup backfill).
export async function connectWithRetry(attempts = 20, delayMs = 5000): Promise<AmqpConnection> {
    const url = config.get<string>('mq.url')
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await amqp.connect(url)
        } catch (e) {
            console.error(`RabbitMQ connect attempt ${attempt}/${attempts} failed:`, (e as Error).message)
            await new Promise(resolve => setTimeout(resolve, delayMs))
        }
    }
    throw new Error(`Could not connect to RabbitMQ after ${attempts} attempts`)
}
