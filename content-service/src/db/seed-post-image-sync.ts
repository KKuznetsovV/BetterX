import { persistImage } from '../media/media-client';
import { updatePostInSeed } from './seed-updater';
import Post from '../models/Post';

export async function syncPostImageUrlsToS3(): Promise<void> {
    const posts = await Post.findAll();

    for (const post of posts) {
        if (!post.imageUrl) {
            continue;
        }

        try {
            const persistedUrl = await persistImage('post-image', post.imageUrl);
            if (persistedUrl === post.imageUrl) {
                continue;
            }

            post.imageUrl = persistedUrl;
            await post.save();
            await updatePostInSeed({
                id: post.id,
                userId: post.userId,
                title: post.title,
                body: post.body,
                imageUrl: post.imageUrl || '',
            });
            console.log(`Synced post image for ${post.id}`);
        } catch (e) {
            console.log(`Failed to sync post image for ${post.id}:`, (e as { message?: string }).message ?? String(e));
        }
    }
}
