import { promises as fs } from 'fs';
import path from 'path';
import sequelize from './sequelize';
import Post from '../models/Post';

const SEED_PATH = path.resolve(__dirname, '../../../db/seed.sql');

// content-service owns its own database (betterx_content), separate from the
// `database` container's initial betterx schema that db/seed.sql originally
// targeted. On a fresh database, replay the posts/comments INSERT statements
// from the shared seed file so demo content still shows up. Idempotent: only
// runs when the posts table is empty.
export async function seedPostsAndCommentsIfEmpty(): Promise<void> {
    const existingCount = await Post.count();
    if (existingCount > 0) {
        return;
    }

    let content: string;
    try {
        content = await fs.readFile(SEED_PATH, 'utf-8');
    } catch (e) {
        console.log('Skipping post/comment seed: seed.sql not found:', (e as { message?: string }).message ?? String(e));
        return;
    }

    const lines = content.split('\n');
    // Posts must be inserted before comments that reference them — replay
    // posts first, then comments, regardless of their original interleaved
    // order in the shared seed file.
    const postStatements = lines.filter(line => line.startsWith('INSERT INTO posts'));
    const commentStatements = lines.filter(line => line.startsWith('INSERT INTO comments'));
    const statements = [...postStatements, ...commentStatements];

    for (const statement of statements) {
        try {
            await sequelize.query(statement);
        } catch (e) {
            console.log('Failed to run seed statement:', (e as { message?: string }).message ?? String(e));
        }
    }

    console.log(`Seeded ${statements.length} post/comment rows into content-service database`);
}
