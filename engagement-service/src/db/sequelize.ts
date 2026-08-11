import { Sequelize } from 'sequelize-typescript'
import config from 'config'
import mysql from 'mysql2/promise'
import Like from '../models/Like'

interface DbConfig {
    host: string
    port?: number
    username: string
    password: string
    database: string
    dialectOptions?: object
}

// Each service owns its own logical database on the shared MySQL server;
// ensure it exists before Sequelize connects (sequelize.sync only creates tables, not databases).
export async function ensureDatabaseExists(): Promise<void> {
    const dbConfig = config.get<DbConfig>('db')
    const connection = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.username,
        password: dbConfig.password,
    })
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    await connection.end()
}

const sequelize = new Sequelize({
    dialect: 'mysql',
    models: [Like],
    logging: console.log,
    ...config.get<DbConfig>('db'),
})

export default sequelize
