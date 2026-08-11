import { QueryTypes } from 'sequelize'
import pgvectorDb from '../db/sequelize'
import PostEmbedding from '../models/PostEmbedding'
import openai from '../openai/openai'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { toSql: vectorToSql } = require('pgvector') as { toSql: (value: number[]) => string }

export interface EmbeddablePost {
    postId: string
    userId: string
    title: string
    body: string
}

// Exported so both post embeddings and arbitrary user-typed "suggest by topic"
// text (see findSuggestedUserIdsByEmbedding below) share the exact same model.
export async function embedText(text: string): Promise<number[]> {
    const embeddingsResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
    })

    const vector = embeddingsResponse.data[0]?.embedding

    if (!vector) {
        throw new Error('could not create embedding for text')
    }

    return vector
}

async function createEmbeddingVector(title: string, body: string): Promise<number[]> {
    return embedText(`${title}\n\n${body}`)
}

export async function storePostEmbedding(post: EmbeddablePost): Promise<void> {
    const vector = await createEmbeddingVector(post.title, post.body)
    await PostEmbedding.upsert({
        postId: post.postId,
        userId: post.userId,
        vector,
    })
    console.log(`stored embedding for post: ${post.postId}`)
}

export async function deletePostEmbedding(postId: string): Promise<void> {
    await PostEmbedding.destroy({ where: { postId } })
    console.log(`deleted embedding for post: ${postId}`)
}

export async function hasPostEmbedding(postId: string): Promise<boolean> {
    const existing = await PostEmbedding.findByPk(postId, { attributes: ['postId'] })
    return !!existing
}

// Finds users whose posts are, on average, closest (by cosine distance) to the
// authenticated user's own posts, excluding the user themself and anyone in
// excludeIds (e.g. users already followed).
export async function findSuggestedUserIds(userId: string, excludeIds: string[], limit: number): Promise<string[]> {
    const rows = await pgvectorDb.query<{ userId: string }>(
        `WITH my_avg AS (
            SELECT avg(vector) AS vector
            FROM post_embeddings
            WHERE user_id = $1
        ),
        other_user_avgs AS (
            SELECT user_id, avg(vector) AS vector
            FROM post_embeddings
            WHERE user_id != $1
            GROUP BY user_id
        )
        SELECT other_user_avgs.user_id AS "userId"
        FROM other_user_avgs, my_avg
        WHERE my_avg.vector IS NOT NULL
        ORDER BY other_user_avgs.vector <=> my_avg.vector`,
        {
            bind: [userId],
            type: QueryTypes.SELECT,
        }
    )

    const excludeSet = new Set(excludeIds)
    return rows
        .map(({ userId: candidateId }) => candidateId)
        .filter(candidateId => !excludeSet.has(candidateId))
        .slice(0, limit)
}

// Same idea as findSuggestedUserIds, but the comparison vector comes from an
// arbitrary piece of text (e.g. a topic/interest the user typed in) instead of
// the authenticated user's own post history.
export async function findSuggestedUserIdsByEmbedding(embedding: number[], excludeIds: string[], limit: number): Promise<string[]> {
    const rows = await pgvectorDb.query<{ userId: string }>(
        `SELECT user_id AS "userId"
        FROM (
            SELECT user_id, avg(vector) AS vector
            FROM post_embeddings
            GROUP BY user_id
        ) other_user_avgs
        ORDER BY other_user_avgs.vector <=> $1`,
        {
            bind: [vectorToSql(embedding)],
            type: QueryTypes.SELECT,
        }
    )

    const excludeSet = new Set(excludeIds)
    return rows
        .map(({ userId: candidateId }) => candidateId)
        .filter(candidateId => !excludeSet.has(candidateId))
        .slice(0, limit)
}
