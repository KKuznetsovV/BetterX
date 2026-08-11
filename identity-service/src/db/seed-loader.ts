import { promises as fs } from 'fs';
import path from 'path';
import sequelize from './sequelize';
import User from '../models/User';

const SEED_PATH = path.resolve(__dirname, '../../../db/seed.sql');

// identity-service owns its own database (betterx_identity), separate from the
// `database` container's initial betterx schema that db/seed.sql originally
// targeted. On a fresh database, replay the users/follows INSERT statements
// from the shared seed file so demo accounts/relationships still show up.
// Idempotent: only runs when the users table is empty.
export async function seedUsersAndFollowsIfEmpty(): Promise<void> {
    const existingCount = await User.count();
    if (existingCount > 0) {
        return;
    }

    let content: string;
    try {
        content = await fs.readFile(SEED_PATH, 'utf-8');
    } catch (e) {
        console.log('Skipping user/follow seed: seed.sql not found:', (e as { message?: string }).message ?? String(e));
        return;
    }

    const lines = content.split('\n');
    // Users must be inserted before follows that reference them — some follow
    // rows in the shared seed file were appended after later user rows, so we
    // can't just replay the file in its original interleaved order.
    const userStatements = lines.filter(line => line.startsWith('INSERT INTO users'));
    const followStatements = lines.filter(line => line.startsWith('INSERT INTO follows'));
    const statements = [...userStatements, ...followStatements];

    for (const statement of statements) {
        try {
            await sequelize.query(statement);
        } catch (e) {
            console.log('Failed to run seed statement:', (e as { message?: string }).message ?? String(e));
        }
    }

    console.log(`Seeded ${statements.length} user/follow rows into identity-service database`);
}
