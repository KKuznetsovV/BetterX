import { promises as fs } from 'fs'
import path from 'path'

const SEED_PATH = path.resolve(__dirname, '../../../db/seed.sql')

function escapeSql(value: string): string {
    return value.replace(/'/g, "''")
}

export async function appendUserToSeed(user: { id: string; name: string; username: string; password: string; avatarUrl?: string | null }): Promise<void> {
    const avatarValue = user.avatarUrl ? `'${escapeSql(user.avatarUrl)}'` : 'NULL'
    const line = `INSERT INTO users (id, name, username, \`password\`, avatar_url, created_at, updated_at) VALUES ('${user.id}', '${escapeSql(user.name)}', '${escapeSql(user.username)}', '${user.password}', ${avatarValue}, NOW(), NOW());\n`
    await fs.appendFile(SEED_PATH, line)
}

export async function updateUserInSeed(user: { id: string; name: string; username: string; password: string; avatarUrl?: string | null }): Promise<void> {
    const content = await fs.readFile(SEED_PATH, 'utf-8')
    const avatarValue = user.avatarUrl ? `'${escapeSql(user.avatarUrl)}'` : 'NULL'
    const newLine = `INSERT INTO users (id, name, username, \`password\`, avatar_url, created_at, updated_at) VALUES ('${user.id}', '${escapeSql(user.name)}', '${escapeSql(user.username)}', '${user.password}', ${avatarValue}, NOW(), NOW());`
    const updated = content.replace(
        new RegExp(`INSERT INTO users \\([^)]+\\) VALUES \\('${user.id}'[^;]+;`),
        newLine
    )
    await fs.writeFile(SEED_PATH, updated)
}

export async function removeUserFromSeed(userId: string): Promise<void> {
    let content = await fs.readFile(SEED_PATH, 'utf-8')
    // Remove the user's INSERT line
    content = content.replace(
        new RegExp(`INSERT INTO users \\([^)]+\\) VALUES \\('${userId}'[^;]+;\n?`),
        ''
    )
    // Remove all posts belonging to this user (user_id is 2nd value in VALUES)
    content = content.replace(
        new RegExp(`INSERT INTO posts \\([^)]+\\) VALUES \\('[^']+', '${userId}'[^;]+;\n?`, 'g'),
        ''
    )
    // Nullify user_id in comments authored by this user (user_id is 3rd value in VALUES)
    content = content.replace(
        new RegExp(`(INSERT INTO comments \\([^)]+\\) VALUES \\('[^']+', '[^']+', )'${userId}'`, 'g'),
        `$1NULL`
    )
    await fs.writeFile(SEED_PATH, content)
}

export async function appendFollowToSeed(followerId: string, followeeId: string): Promise<void> {
    const line = `INSERT INTO follows (follower_id, followee_id, created_at, updated_at) VALUES ('${followerId}', '${followeeId}', NOW(), NOW());\n`
    await fs.appendFile(SEED_PATH, line)
}

export async function removeFollowFromSeed(followerId: string, followeeId: string): Promise<void> {
    const content = await fs.readFile(SEED_PATH, 'utf-8')
    const updated = content.replace(
        new RegExp(`INSERT INTO follows \\([^)]+\\) VALUES \\('${followerId}', '${followeeId}'[^;]+;\n?`),
        ''
    )
    await fs.writeFile(SEED_PATH, updated)
}
