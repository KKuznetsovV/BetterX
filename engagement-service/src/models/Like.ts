import { AllowNull, Column, DataType, Default, Model, PrimaryKey, Table } from 'sequelize-typescript'

@Table({ underscored: true })
export default class Like extends Model {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    id: string

    @AllowNull(false)
    @Column(DataType.UUID)
    userId: string

    @AllowNull(true)
    @Column(DataType.UUID)
    postId: string | null

    @AllowNull(true)
    @Column(DataType.UUID)
    commentId: string | null

    @AllowNull(false)
    @Column(DataType.STRING(10))
    emoji: string
}
