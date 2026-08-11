import { AllowNull, BelongsToMany, Column, DataType, Default, Index, Min, Model, PrimaryKey, Table } from 'sequelize-typescript';
import Follow from './Follow';

@Table({
    underscored: true,
})
export default class User extends Model {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
     id: string;


    @AllowNull(false)
    @Min(6)
    @Column(DataType.STRING)
     name: string;


    @AllowNull(false)
    @Index({ unique: true })
    @Min(6)
    @Column(DataType.STRING)
     username: string;


    @AllowNull(false)
    @Column(DataType.STRING)
     password: string;

      @AllowNull(true)
     @Column(DataType.TEXT)
      avatarUrl: string | null;

      @BelongsToMany(() => User, () => Follow, 'followerId', 'followeeId')
      following: User[];

      @BelongsToMany(() => User, () => Follow, 'followeeId', 'followerId')
      followers: User[];
}
