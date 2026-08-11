import type { NextFunction, Request, Response } from 'express'
import { embedText, findSuggestedUserIds, findSuggestedUserIdsByEmbedding } from '../../embeddings/embeddings'
import { fetchAllUsers, fetchFollowingIds, type UserSnapshot } from '../../identity/identity-client'
import { fetchUserPosts, type PostSnapshot } from '../../content/content-client'
import openai from '../../openai/openai'

const DEFAULT_LIMIT = 5
const MAX_TOPIC_LENGTH = 200

export interface SuggestedUser {
    userId: string
    name: string
    username: string
    avatarUrl: string | null
    reasonToFollow: string
}

interface LlmRecommendation {
    userId: string
    reasonToFollow: string
}

type RankingContext =
    | { kind: 'own-posts'; name: string; username: string; posts: PostSnapshot[] }
    | { kind: 'topic'; topic: string }

async function rankCandidatesWithLlm(
    context: RankingContext,
    candidates: { userId: string; name: string; username: string; posts: { title: string; body: string }[] }[]
): Promise<LlmRecommendation[]> {
    const systemPrompt = context.kind === 'topic'
        ? `
You are a social network recommendation assistant.
The authenticated user typed in a topic/interest they want to find other users about.
You will receive that topic and a list of candidate users found by content similarity to it.
Each candidate includes their posts (title and body).

Recommend which candidate users are genuinely relevant to the given topic based on their posts.
Write each reasonToFollow as a short explanation of how that candidate relates to the topic.
If none of the candidates' posts are actually about or related to the topic, return an empty
array - do not force a weak or unrelated match just to include something.

Return ONLY a JSON array with this exact shape:
[
  { "userId": "<candidate user id>", "reasonToFollow": "<explanation>" }
]

Only include candidates that are actually relevant to the topic.
Order by strongest relevance first.
`.trim()
        : `
You are a social network recommendation assistant.
You will receive the authenticated user's profile and a list of candidate users found by content similarity.
Each user includes their posts (title and body).

Recommend which candidate users the authenticated user should follow based on shared interests, complementary content, and post similarity.
Write each reasonToFollow as a short, personalized explanation addressed to the authenticated user.

Return ONLY a JSON array with this exact shape:
[
  { "userId": "<candidate user id>", "reasonToFollow": "<explanation>" }
]

Only include candidates you actually recommend.
Order by strongest recommendation first.
`.trim()

    const userContent = context.kind === 'topic'
        ? JSON.stringify({ topic: context.topic, candidates }, null, 2)
        : JSON.stringify({ authenticatedUser: { name: context.name, username: context.username, posts: context.posts }, candidates }, null, 2)

    const llmResponse = await openai.responses.create({
        model: 'gpt-4.1-mini',
        input: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
        ],
    })

    const rawResult = llmResponse.output_text?.trim()
    if (!rawResult) {
        throw new Error('could not extract follow suggestions from llm response')
    }

    const jsonText = rawResult.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const recommendations = JSON.parse(jsonText)

    if (!Array.isArray(recommendations)) {
        throw new Error('llm follow suggestions response is not an array')
    }

    return recommendations.filter((r): r is LlmRecommendation =>
        typeof r?.userId === 'string' && typeof r?.reasonToFollow === 'string'
    )
}

export async function suggestUsers(request: Request, response: Response, next: NextFunction) {
    try {
        const { userId } = request
        const authHeader = request.get('Authorization')
        const limit = Math.min(Number(request.query.limit) || DEFAULT_LIMIT, 20)
        // Optional user-typed parameter: when present, suggestions are based on
        // relevance to this text instead of the authenticated user's own posts.
        const rawTopic = typeof request.query.topic === 'string' ? request.query.topic.trim() : ''
        const topic = rawTopic.length > 0 ? rawTopic.slice(0, MAX_TOPIC_LENGTH) : null

        const followingIds = await fetchFollowingIds(authHeader!)
        const excludeIds = [userId, ...followingIds]

        const candidateIds = topic
            ? await findSuggestedUserIdsByEmbedding(await embedText(topic), excludeIds, limit)
            : await findSuggestedUserIds(userId, excludeIds, limit)

        if (candidateIds.length === 0) {
            return response.json([])
        }

        const usersById = await fetchAllUsers(authHeader)
        const [myPosts, ...candidatePosts] = await Promise.all([
            topic ? Promise.resolve<PostSnapshot[]>([]) : fetchUserPosts(userId, authHeader),
            ...candidateIds.map(id => fetchUserPosts(id, authHeader)),
        ])

        const me = usersById.get(userId)
        const candidateUsers = candidateIds
            .map((id, index) => {
                const user = usersById.get(id)
                if (!user) return null
                return { user, posts: candidatePosts[index] ?? [] }
            })
            .filter((c): c is { user: UserSnapshot; posts: PostSnapshot[] } => !!c)

        const fallback: SuggestedUser[] = candidateUsers.map(({ user }) => ({
            userId: user.id,
            name: user.name,
            username: user.username,
            avatarUrl: user.avatarUrl,
            reasonToFollow: topic ? `Suggested based on your topic: "${topic}"` : 'Suggested based on similar interests to yours.',
        }))

        if (!topic && !me) {
            return response.json(fallback)
        }

        try {
            const rankingContext: RankingContext = topic
                ? { kind: 'topic', topic }
                : { kind: 'own-posts', name: me!.name, username: me!.username, posts: myPosts }

            const recommendations = await rankCandidatesWithLlm(
                rankingContext,
                candidateUsers.map(({ user, posts }) => ({ userId: user.id, name: user.name, username: user.username, posts }))
            )

            const allowedIds = new Set(candidateIds)
            const usersByIdMap = new Map(candidateUsers.map(({ user }) => [user.id, user]))

            const validated: SuggestedUser[] = recommendations
                .filter(r => allowedIds.has(r.userId) && usersByIdMap.has(r.userId))
                .map(r => {
                    const user = usersByIdMap.get(r.userId)!
                    return { userId: user.id, name: user.name, username: user.username, avatarUrl: user.avatarUrl, reasonToFollow: r.reasonToFollow }
                })

            // Respect the LLM's judgment even if it recommends nobody - only
            // the catch block (an actual failed call) should fall back to
            // the raw similarity list.
            response.json(validated)
        } catch (llmError) {
            // OpenAI key missing/rate-limited/etc. should not break the whole
            // feature - fall back to similarity-only suggestions without an
            // LLM-written reason.
            console.error('llm follow-suggestion ranking failed, falling back to similarity-only order:', llmError)
            response.json(fallback)
        }
    } catch (e) {
        next(e)
    }
}
