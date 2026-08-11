import '../db/pgvector-sequelize'
import { DataTypes } from 'sequelize'
import { AllowNull, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript'

type PgvectorDataTypes = typeof DataTypes & {
    VECTOR: (dimensions?: number) => ReturnType<typeof DataTypes.ABSTRACT>
}
const embeddingVectorType = (DataTypes as PgvectorDataTypes).VECTOR(1536)

// One row per post, embedding the post's title+body via OpenAI's
// text-embedding-3-small (1536 dimensions). Used to find users whose posts
// are semantically similar to the authenticated user's posts.
@Table({
    underscored: true,
    tableName: 'post_embeddings',
})
export default class PostEmbedding extends Model {

    // STRING, not UUID: content-service's post ids live in MySQL as loosely-typed
    // strings and are not guaranteed to be valid hex UUIDs (some seed fixtures use
    // readable ids like 'ux000004-0000-4000-8000-000000000004'). Postgres' native
    // uuid type rejects those outright, so this column must stay string-typed.
    @PrimaryKey
    @AllowNull(false)
    @Column(DataType.STRING)
    postId: string

    @AllowNull(false)
    @Column(DataType.STRING)
    userId: string

    @AllowNull(false)
    @Column({
        type: embeddingVectorType,
    })
    vector: number[]
}
