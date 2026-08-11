import { AllowNull, Column, DataType, Default, ForeignKey, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import Comment from './Comment';

export const POST_INCLUDE = [
    {
        model: Comment,
        required: false,
    }
];

@Table({
    underscored: true,
})
export default class Post extends Model {

        @PrimaryKey
        @Default(DataType.UUIDV4)
        @Column(DataType.UUID)
         id: string;

        @AllowNull(false)
        @Column(DataType.UUID)
         userId: string;


        @AllowNull(false)
        @Column(DataType.STRING(255))
         title: string;


        @AllowNull(false)
        @Column(DataType.TEXT)
         body: string;


        @AllowNull(true)
        @Column(DataType.STRING)
         imageUrl: string;

        @HasMany(() => Comment, {
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
         })
          comments: Comment[];
}
