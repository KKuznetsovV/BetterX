import { AllowNull, BelongsTo, Column, DataType, Default, ForeignKey, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import Post from './Post';

@Table({
    underscored: true,
})
export default class Comment extends Model {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
     id: string;

    @ForeignKey(() => Post)
    @AllowNull(false)
    @Column(DataType.UUID)
     postId: string;

    @AllowNull(true)
    @Column(DataType.UUID)
     userId: string | null;

    @AllowNull(true)
    @ForeignKey(() => Comment)
    @Column(DataType.UUID)
     parentId: string | null;

    @AllowNull(false)
    @Column(DataType.TEXT)
     body: string;

     @BelongsTo(() => Post)
      post: Post;

    @BelongsTo(() => Comment, { as: 'parent', foreignKey: 'parentId' })
     parent: Comment;

    @HasMany(() => Comment, { as: 'replies', foreignKey: 'parentId' })
     replies: Comment[];
}
