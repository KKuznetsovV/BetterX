import { promises as fs } from 'fs'
import path from 'path'

const SEED_PATH = path.resolve(__dirname, '../../../db/seed.sql')

function escapeSql(value: string): string {
    return value.replace(/'/g, "''")
}

export async function appendPostToSeed(post: { id: string; userId: string; title: string; body: string; imageUrl: string }): Promise<void> {
    const line = `INSERT INTO posts (id, user_id, title, body, image_url, created_at, updated_at) VALUES ('${post.id}', '${post.userId}', '${escapeSql(post.title)}', '${escapeSql(post.body)}', '${escapeSql(post.imageUrl || '')}', NOW(), NOW());\n`
    await fs.appendFile(SEED_PATH, line)
}

export async function updatePostInSeed(post: { id: string; userId: string; title: string; body: string; imageUrl: string }): Promise<void> {
    const content = await fs.readFile(SEED_PATH, 'utf-8')
    const newLine = `INSERT INTO posts (id, user_id, title, body, image_url, created_at, updated_at) VALUES ('${post.id}', '${post.userId}', '${escapeSql(post.title)}', '${escapeSql(post.body)}', '${escapeSql(post.imageUrl || '')}', NOW(), NOW());`
    const updated = content.replace(
        new RegExp(`INSERT INTO posts \\([^)]+\\) VALUES \\('${post.id}'[^;]+;`),
        newLine
    )
    await fs.writeFile(SEED_PATH, updated)
}

export async function appendCommentToSeed(comment: { id: string; postId: string; userId: string; body: string }): Promise<void> {
    const line = `INSERT INTO comments (id, post_id, user_id, body, created_at, updated_at) VALUES ('${comment.id}', '${comment.postId}', '${comment.userId}', '${escapeSql(comment.body)}', NOW(), NOW());\n`
    await fs.appendFile(SEED_PATH, line)
}

export async function updateCommentInSeed(comment: { id: string; postId: string; userId: string; body: string }): Promise<void> {
    const content = await fs.readFile(SEED_PATH, 'utf-8')
    const newLine = `INSERT INTO comments (id, post_id, user_id, body, created_at, updated_at) VALUES ('${comment.id}', '${comment.postId}', '${comment.userId}', '${escapeSql(comment.body)}', NOW(), NOW());`
    const updated = content.replace(
        new RegExp(`INSERT INTO comments \\([^)]+\\) VALUES \\('${comment.id}'[^;]+;`),
        newLine
    )
    await fs.writeFile(SEED_PATH, updated)
}
