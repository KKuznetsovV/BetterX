import { Transaction } from 'sequelize'
import OutboxEvent from '../models/OutboxEvent'
import { getChannel, EVENTS_EXCHANGE } from './rabbitmq'

const POLL_INTERVAL_MS = 1000
const BATCH_SIZE = 50

// Writes the event into the same DB transaction as the domain write it
// accompanies - this is the whole point of the outbox pattern: a post/
// comment row and its corresponding event either both commit or both roll
// back, so a crash or an unreachable RabbitMQ right after the DB commit can
// no longer silently lose the event (the old direct channel.publish() call
// added in earlier steps had exactly that gap).
export async function enqueueEvent(transaction: Transaction, routingKey: string, payload: unknown): Promise<void> {
    await OutboxEvent.create({ exchange: EVENTS_EXCHANGE, routingKey, payload }, { transaction })
}

let polling = false

async function publishPendingEvents(): Promise<void> {
    const pending = await OutboxEvent.findAll({
        where: { publishedAt: null },
        order: [['createdAt', 'ASC']],
        limit: BATCH_SIZE,
    })
    if (pending.length === 0) return

    const channel = await getChannel()
    for (const event of pending) {
        channel.publish(EVENTS_EXCHANGE, event.routingKey, Buffer.from(JSON.stringify(event.payload)), {
            persistent: true,
            contentType: 'application/json',
        })
        await event.update({ publishedAt: new Date() })
    }
}

// Polls for unpublished outbox rows and publishes them - runs independently
// of any single request, so a RabbitMQ outage only delays delivery (rows
// stay unpublished and get retried on the next tick) instead of losing
// events. `polling` guards against overlapping ticks double-publishing a row
// if one tick is still running when the next one fires.
export function startOutboxPoller(): void {
    setInterval(() => {
        if (polling) return
        polling = true
        publishPendingEvents()
            .catch(e => console.error('Failed to publish pending outbox events:', e))
            .finally(() => { polling = false })
    }, POLL_INTERVAL_MS)
}
