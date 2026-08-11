import config from 'config'
import amqp from 'amqplib'

export const EVENTS_EXCHANGE = 'betterx.events'

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>

let channel: AmqpChannel | null = null
let connecting: Promise<AmqpChannel> | null = null

async function connect(): Promise<AmqpChannel> {
    const url = config.get<string>('mq.url')
    const connection = await amqp.connect(url)
    const newChannel = await connection.createChannel()
    await newChannel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true })

    connection.on('close', () => {
        channel = null
    })
    connection.on('error', (e: Error) => {
        console.error('RabbitMQ connection error:', e.message)
    })

    channel = newChannel
    return newChannel
}

// Lazily connects on first publish and reconnects on the next call after a
// dropped connection - callers must treat every getChannel()/publish call as
// fallible (RabbitMQ being briefly unreachable must never break post/comment
// CRUD, matching the existing fire-and-forget philosophy of this codebase).
export async function getChannel(): Promise<AmqpChannel> {
    if (channel) return channel
    if (!connecting) connecting = connect().finally(() => { connecting = null })
    return connecting
}
