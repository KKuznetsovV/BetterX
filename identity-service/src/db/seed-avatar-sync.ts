import User from '../models/User';
import config from 'config';

const SEED_AVATAR_MAP: Record<string, string> = {
    nikita:    'nikita.avif',
    diana0:    'diana.avif',
    vladimir:  'vladimir.avif',
    bob000:    'bob.avif',
    alice0:    'alice.avif',
    charlie:   'charlie.avif',
    gustav:    'gustav.avif',
    baranchik: 'baranchik.avif',
};

function extractBucketObjectKey(imageUrl: string, bucket: string): string | null {
    try {
        const parsed = new URL(imageUrl);
        const pathname = parsed.pathname.replace(/^\/+/, '');
        if (pathname.startsWith(`${bucket}/`)) {
            return pathname.slice(bucket.length + 1);
        }

        if (parsed.hostname === bucket || parsed.hostname.startsWith(`${bucket}.`)) {
            return pathname;
        }

        return null;
    } catch {
        return null;
    }
}

function normalizeAvatarUrlToPublicEndpoint(avatarUrl: string): string | null {
    const bucket = config.get<string>('aws.avatarsBucket');
    const publicEndpoint = config.has('aws.publicEndpoint')
        ? config.get<string>('aws.publicEndpoint').replace(/\/$/, '')
        : null;

    if (!publicEndpoint) {
        return null;
    }

    const key = extractBucketObjectKey(avatarUrl, bucket);
    if (!key) {
        return null;
    }

    return `${publicEndpoint}/${bucket}/${key}`;
}

function buildSeedAvatarUrl(key: string): string {
    const bucket = config.get<string>('aws.avatarsBucket');
    const publicEndpoint = config.has('aws.publicEndpoint')
        ? config.get<string>('aws.publicEndpoint')
        : config.has('aws.connection.endpoint')
            ? config.get<string>('aws.connection.endpoint')
            : null;
    const region = config.get<string>('aws.connection.region');
    return publicEndpoint
        ? `${publicEndpoint}/${bucket}/${key}`
        : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}


export async function syncSeedAvatarUrls(): Promise<void> {
    const users = await User.findAll({ attributes: ['id', 'username', 'avatarUrl'] });
    for (const user of users) {
        try {
            if (!user.avatarUrl) continue;
            const normalizedUrl = normalizeAvatarUrlToPublicEndpoint(user.avatarUrl);
            if (!normalizedUrl || normalizedUrl === user.avatarUrl) continue;
            user.avatarUrl = normalizedUrl;
            await user.save();
            console.log(`Normalized avatar URL for @${user.username}`);
        } catch (e) {
            console.log(`Failed to normalize avatar URL for @${user.username}:`, e.message);
        }
    }

    const internalEndpoint = config.has('aws.connection.endpoint')
        ? config.get<string>('aws.connection.endpoint')
        : null;

    for (const [username, key] of Object.entries(SEED_AVATAR_MAP)) {
        try {
            const correctUrl = buildSeedAvatarUrl(key);
            const user = await User.findOne({ where: { username } });
            if (!user || user.avatarUrl === correctUrl) continue;
            // Skip if the user has a non-seed custom avatar that still exists
            if (user.avatarUrl && !user.avatarUrl.endsWith(`/${key}`)) {
                const checkUrl = internalEndpoint
                    ? user.avatarUrl.replace(/^https?:\/\/[^/]+/, internalEndpoint)
                    : user.avatarUrl;
                const res = await fetch(checkUrl, { method: 'HEAD' });
                if (res.ok) continue;
            }
            user.avatarUrl = correctUrl;
            await user.save();
            console.log(`Synced avatar URL for @${username}`);
        } catch (e) {
            console.log(`Failed to sync avatar URL for @${username}:`, e.message);
        }
    }
}
