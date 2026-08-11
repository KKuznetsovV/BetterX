import type { Request, Response, NextFunction } from 'express';
import config from 'config';
import { generatePresignedUploadUrl } from '../../aws/aws';

const ALLOWED_CONTENT_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif',
]);

export async function getPresignedUploadUrl(
    request: Request<{}, {}, {}, { type: string; contentType: string }>,
    response: Response,
    next: NextFunction
) {
    try {
        const { type, contentType } = request.query;

        if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
            return next({ status: 422, message: `Unsupported content type: ${contentType}` });
        }

        const bucket = type === 'avatar'
            ? config.get<string>('aws.avatarsBucket')
            : config.get<string>('aws.bucket');

        const result = await generatePresignedUploadUrl(bucket, contentType);
        response.json(result);
    } catch (e) {
        next(e);
    }
}
