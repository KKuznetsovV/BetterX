import { AllowNull, Column, DataType, Default, Model, PrimaryKey, Table } from 'sequelize-typescript'

@Table({ underscored: true })
export default class Notification extends Model {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    id: string

    @AllowNull(false)
    @Column(DataType.UUID)
    recipientId: string

    @AllowNull(true)
    @Column(DataType.UUID)
    actorId: string | null

    @AllowNull(true)
    @Column(DataType.STRING)
    actorName: string | null

    @AllowNull(true)
    @Column(DataType.STRING)
    actorUsername: string | null

    @AllowNull(true)
    @Column(DataType.TEXT)
    actorAvatarUrl: string | null

    @AllowNull(false)
    @Column(DataType.ENUM('comment', 'follow', 'post'))
    type: 'comment' | 'follow' | 'post'

    @AllowNull(true)
    @Column(DataType.UUID)
    postId: string | null

    @AllowNull(true)
    @Column(DataType.UUID)
    commentId: string | null

    @Default(false)
    @Column(DataType.BOOLEAN)
    read: boolean
}
