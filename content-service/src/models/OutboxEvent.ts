import { AllowNull, Column, DataType, Default, Model, PrimaryKey, Table } from 'sequelize-typescript'

// Transactional outbox: a row here is written in the SAME DB transaction as
// the domain write it accompanies (Post/Comment create/update/destroy), so
// the two either both commit or both roll back. A separate poller
// (mq/outbox.ts) publishes unpublished rows to RabbitMQ and marks
// publishedAt - this closes the dual-write gap the old in-request
// channel.publish() calls had (DB commit succeeds but the process crashes,
// or RabbitMQ is briefly unreachable, before the event is ever sent).
@Table({
    underscored: true,
    tableName: 'outbox_events',
})
export default class OutboxEvent extends Model {

    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    id: string

    @AllowNull(false)
    @Column(DataType.STRING)
    exchange: string

    @AllowNull(false)
    @Column(DataType.STRING)
    routingKey: string

    @AllowNull(false)
    @Column(DataType.JSON)
    payload: unknown

    @AllowNull(true)
    @Column(DataType.DATE)
    publishedAt: Date | null
}
