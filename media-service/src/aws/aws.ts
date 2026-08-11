import { CreateBucketCommand, PutBucketCorsCommand, PutBucketPolicyCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import config from "config";
import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import path from "path";

const s3Config = JSON.parse(JSON.stringify(config.get('aws.connection')));

const s3Client = new S3Client({ ...s3Config, requestChecksumCalculation: 'WHEN_REQUIRED' });

// Presign client uses public endpoint so signature host matches what the browser sends
const presignConfig = { ...s3Config };
if (config.has('aws.publicEndpoint')) {
    presignConfig.endpoint = config.get<string>('aws.publicEndpoint');
}
const presignClient = new S3Client({ ...presignConfig, requestChecksumCalculation: 'WHEN_REQUIRED' });

const CORS_RULES = {
    CORSRules: [{
        AllowedOrigins: ['*'],
        AllowedMethods: ['PUT', 'GET', 'HEAD'],
        AllowedHeaders: ['*'],
        MaxAgeSeconds: 3000,
    }]
};

function isMinioEndpoint(endpoint: unknown): boolean {
    if (typeof endpoint !== 'string') return false
    return endpoint.includes('minio') || endpoint.includes(':9000')
}

async function createBucketWithCors(bucket: string): Promise<void> {
    try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
        console.log(`Bucket ${bucket} created`);
    } catch (e) {
        console.log(`Bucket ${bucket} already exists or error:`, e.message);
    }
    const endpoint = (s3Config as { endpoint?: string }).endpoint
    if (isMinioEndpoint(endpoint)) {
        console.log(`Skipping bucket-level CORS for ${bucket} on MinIO endpoint (${endpoint})`)
    } else {
        try {
            await s3Client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: CORS_RULES }));
            console.log(`CORS configured for ${bucket}`);
        } catch (e) {
            console.log(`CORS config error for ${bucket}:`, (e as { message?: string }).message ?? String(e));
        }
    }
    try {
        await s3Client.send(new PutBucketPolicyCommand({
            Bucket: bucket,
            Policy: JSON.stringify({
                Version: '2012-10-17',
                Statement: [{ Effect: 'Allow', Principal: '*', Action: ['s3:GetObject'], Resource: [`arn:aws:s3:::${bucket}/*`] }]
            })
        }));
        console.log(`Public read policy set for ${bucket}`);
    } catch (e) {
        console.log(`Policy error for ${bucket}:`, e.message);
    }
}

export async function createAppBucketIfNotExists() {
    await createBucketWithCors(config.get<string>('aws.bucket'));
}

export async function createAvatarsBucketIfNotExists() {
    await createBucketWithCors(config.get<string>('aws.avatarsBucket'));
}

const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/gif': 'gif',
};

const EXT_TO_MIME: Record<string, string> = Object.fromEntries(
    Object.entries(MIME_TO_EXT).map(([mime, ext]) => [ext, mime])
);

function normalizeMimeType(contentType: string | null): string | null {
    return contentType?.split(';')[0]?.trim().toLowerCase() ?? null;
}

function getImageExtensionFromPathname(pathname: string): string | null {
    const ext = pathname.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    if (!ext) {
        return null;
    }

    if (ext === 'jpeg') {
        return 'jpg';
    }

    return ext in EXT_TO_MIME ? ext : null;
}

function extractBucketObjectKey(imageUrl: string, bucket: string): string | null {
    try {
        const parsedUrl = new URL(imageUrl);
        const pathname = parsedUrl.pathname.replace(/^\/+/, '');
        if (pathname.startsWith(`${bucket}/`)) {
            return pathname.slice(bucket.length + 1);
        }

        if (parsedUrl.hostname === bucket || parsedUrl.hostname.startsWith(`${bucket}.`)) {
            return pathname;
        }

        return null;
    } catch {
        return null;
    }
}

export function buildPublicObjectUrl(bucket: string, key: string): string {
    const publicEndpoint = config.has('aws.publicEndpoint')
        ? config.get<string>('aws.publicEndpoint')
        : config.has('aws.connection.endpoint')
            ? config.get<string>('aws.connection.endpoint')
            : `https://${bucket}.s3.${config.get<string>('aws.connection.region')}.amazonaws.com`;

    if (publicEndpoint.includes(`://${bucket}.`)) {
        return `${publicEndpoint.replace(/\/$/, '')}/${key}`;
    }

    return `${publicEndpoint.replace(/\/$/, '')}/${bucket}/${key}`;
}

async function uploadImageBuffer(bucket: string, body: Buffer, contentType: string, key?: string): Promise<string> {
    const ext = MIME_TO_EXT[contentType] || getImageExtensionFromPathname(key ?? '') || 'bin';
    const resolvedKey = key ?? `${randomUUID()}.${ext}`;

    await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: resolvedKey,
        Body: body,
        ContentType: contentType,
    }));

    return buildPublicObjectUrl(bucket, resolvedKey);
}

export async function persistImageSourceToS3(bucket: string, source: string): Promise<string> {
    const existingKey = extractBucketObjectKey(source, bucket);
    if (existingKey) {
        return buildPublicObjectUrl(bucket, existingKey);
    }

    if (source.startsWith('data:')) {
        const dataMatch = source.match(/^data:([^;]+);base64,(.+)$/s);
        const mimeType = normalizeMimeType(dataMatch?.[1] ?? null);
        if (!dataMatch || !mimeType || !(mimeType in MIME_TO_EXT)) {
            throw { status: 422, message: 'Unsupported inline image format' };
        }

        const imageBuffer = Buffer.from(dataMatch[2], 'base64');
        return uploadImageBuffer(bucket, imageBuffer, mimeType);
    }

    const response = await fetch(source, {
        signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
        throw { status: 422, message: `Unable to fetch image from ${source}` };
    }

    const responseUrl = new URL(response.url);
    const sourceUrl = new URL(source);
    const mimeType = normalizeMimeType(response.headers.get('content-type'));
    const extension = mimeType && mimeType in MIME_TO_EXT
        ? MIME_TO_EXT[mimeType]
        : getImageExtensionFromPathname(responseUrl.pathname) ?? getImageExtensionFromPathname(sourceUrl.pathname);

    if (!extension) {
        throw { status: 422, message: 'Unsupported remote image format' };
    }

    const contentType = mimeType ?? EXT_TO_MIME[extension];
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    return uploadImageBuffer(bucket, imageBuffer, contentType, `${randomUUID()}.${extension}`);
}

export async function generatePresignedUploadUrl(bucket: string, contentType: string): Promise<{ uploadUrl: string; imageUrl: string }> {
    const ext = MIME_TO_EXT[contentType] || 'bin';
    const key = `${randomUUID()}.${ext}`;

    // presignClient is configured with the public endpoint, so the signed Host matches what the browser sends
    const uploadUrl = await getSignedUrl(presignClient, new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
    }), { expiresIn: 300 });

    const imageUrl = buildPublicObjectUrl(bucket, key);

    return { uploadUrl, imageUrl };
}

const PUBLIC_DIR = path.join(__dirname, '../../public');

const SEED_AVATARS: Array<{ key: string; file: string }> = [
    { key: 'alice.avif',     file: 'Alice.avif' },
    { key: 'baranchik.avif', file: 'premium_photo-1689977927774-401b12d137d6.avif' },
    { key: 'bob.avif',       file: 'Bob.avif' },
    { key: 'charlie.avif',   file: 'Charlie.avif' },
    { key: 'default.avif',   file: 'iStock-1248448159 (1).avif' },
    { key: 'diana.avif',     file: 'Diana.avif' },
    { key: 'gustav.avif',    file: 'Gustav.avif' },
    { key: 'nikita.avif',    file: 'Nikita.avif' },
    { key: 'vladimir.avif',  file: 'Vladimir.avif' },
];

export async function seedAvatarsToS3(): Promise<void> {
    const bucket = config.get<string>('aws.avatarsBucket');
    for (const avatar of SEED_AVATARS) {
        try {
            const body = await readFile(path.join(PUBLIC_DIR, avatar.file));
            await s3Client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: avatar.key,
                Body: body,
                ContentType: 'image/avif',
            }));
            console.log(`Seeded avatar: ${avatar.key}`);
        } catch (e) {
            console.log(`Failed to seed avatar ${avatar.key}:`, e.message);
        }
    }
}

export default s3Client;
