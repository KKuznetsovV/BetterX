import { fetchAllPostsPage } from '../content/content-client'
import { hasPostEmbedding, storePostEmbedding } from './embeddings'

const PAGE_SIZE = 50
const RETRY_DELAY_MS = 5000
const MAX_ATTEMPTS = 20 // ~1.5 minutes of retrying, covers slow container startup ordering

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function runOnce(): Promise<number> {
    let offset = 0
    let embedded = 0

    while (true) {
        const posts = await fetchAllPostsPage(PAGE_SIZE, offset)
        if (posts.length === 0) break

        for (const post of posts) {
            try {
                if (await hasPostEmbedding(post.id)) continue
                await storePostEmbedding({ postId: post.id, userId: post.userId, title: post.title, body: post.body })
                embedded++
            } catch (e) {
                // One malformed/unembeddable post must not abort the whole
                // backfill run for every other post.
                console.error(`failed to backfill embedding for post ${post.id}, skipping:`, e)
            }
        }

        offset += PAGE_SIZE
    }

    return embedded
}

// Runs at startup so posts created before this service existed (or missed an
// embedding call due to a transient failure) still get embedded eventually.
// content-service is frequently not accepting connections yet when this
// service boots (docker-compose depends_on only guarantees the container
// process started, not that it's ready) - retry with a fixed delay instead of
// giving up after the first failure. Never throws - a slow/unreachable
// content-service must not prevent this service itself from listening.
export async function backfillMissingPostEmbeddings(): Promise<void> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const embedded = await runOnce()
            console.log(`post embedding backfill complete (attempt ${attempt}), embedded ${embedded} post(s)`)
            return
        } catch (e) {
            const isLastAttempt = attempt === MAX_ATTEMPTS
            console.error(`post embedding backfill attempt ${attempt}/${MAX_ATTEMPTS} failed${isLastAttempt ? ', giving up until next restart' : `, retrying in ${RETRY_DELAY_MS}ms`}:`, e)
            if (isLastAttempt) return
            await delay(RETRY_DELAY_MS)
        }
    }
}
