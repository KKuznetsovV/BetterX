import type { Request, Response, NextFunction } from 'express';
import config from 'config';
import { persistImageSourceToS3 } from '../../aws/aws';

export async function persistImage(
    request: Request<{}, {}, { type: 'post-image' | 'avatar'; source: string }>,
    response: Response,
    next: NextFunction
) {
    try {
        const { type, source } = request.body;
        const bucket = type === 'avatar'
            ? config.get<string>('aws.avatarsBucket')
            : config.get<string>('aws.bucket');

        const url = await persistImageSourceToS3(bucket, source);
        response.json({ url });
    } catch (e) {
        const err = e as { status?: number; message?: string };
        next({ status: err.status ?? 500, message: err.message ?? 'Image persistence failed' });
    }
}
