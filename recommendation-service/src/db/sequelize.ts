import config from 'config'
import { Client } from 'pg'
import { Sequelize } from 'sequelize-typescript'
import PostEmbedding from '../models/PostEmbedding'

interface PgvectorConfig {
    host: string
    port?: number
    username: string
    password: string
    database: string
}

// The pgvector container is a dedicated Postgres instance (see root pgvector/
// Dockerfile) that already runs `CREATE EXTENSION IF NOT EXISTS vector` on
// first init via init.sql. Re-running it here too makes the service resilient
// to being pointed at a plain Postgres instance that hasn't run that init
// script (e.g. a developer's own local Postgres).
export async function ensureVectorExtension(): Promise<void> {
    const dbConfig = config.get<PgvectorConfig>('pgvector')
    const client = new Client({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
    })
    await client.connect()
    await client.query('CREATE EXTENSION IF NOT EXISTS vector')
    await client.end()
}

const pgvectorDb = new Sequelize({
    dialect: 'postgres',
    models: [PostEmbedding],
    logging: console.log,
    ...config.get<PgvectorConfig>('pgvector'),
})

export default pgvectorDb
