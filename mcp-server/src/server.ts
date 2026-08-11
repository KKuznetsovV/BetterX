import Ajv, { type ValidateFunction } from 'ajv'
import config from 'config'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
    type CallToolResult,
    type ListResourcesResult,
    type ReadResourceResult,
    type Tool,
    CallToolRequestSchema,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
    ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { sign } from 'jsonwebtoken'
import socket from './io/io'
import SocketMessages from 'socket-enums-kkuznetsovv-123'

type ToolName = 'get_latest_posts' | 'adjust_text_tone' | 'generate_ai_image' | 'publish_mcp_post'
type Tone = 'funny' | 'formal' | 'sarcastic' | 'professional'

interface GetLatestPostsArgs {
    limit?: number
    offset?: number
}

interface AdjustTextToneArgs {
    text: string
    tone: Tone
}

interface GenerateAiImageArgs {
    prompt: string
}

interface PublishMcpPostArgs {
    text: string
    imageUrl?: string
}

interface LatestPostView {
    id: string
    title: string
    body: string
    imageUrl: string | null
    createdAt: string
    user: {
        id: string
        name: string
        username: string
        avatarUrl: string | null
    } | null
    likeCount: number
    commentCount: number
}

interface AiServiceStatus {
    configured: boolean
    connectivity: 'not_configured' | 'unknown' | 'ok' | 'error' | 'rate_limited'
    lastSuccessAt: string | null
    lastErrorAt: string | null
    lastError: string | null
    rateLimit: {
        isLimited: boolean
        consecutive429: number
        lastRateLimitAt: string | null
    }
}

interface AiStatusResource {
    openai: AiServiceStatus
    gemini: AiServiceStatus
}

class PublishBroadcastError extends Error {
    public readonly postId: string

    public constructor(message: string, postId: string) {
        super(message)
        this.name = 'PublishBroadcastError'
        this.postId = postId
    }
}

const MCP_SERVER_NAME = 'betterx-mcp-server'
const LATEST_POSTS_RESOURCE_URI = 'posts://latest'
const AI_STATUS_RESOURCE_URI = 'system://ai-status'

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20
const DEFAULT_OFFSET = 0

type InputSchema = Tool['inputSchema']

const getLatestPostsInputSchema: InputSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT },
        offset: { type: 'integer', minimum: 0 },
    },
}

const adjustTextToneInputSchema: InputSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        text: { type: 'string', minLength: 1, maxLength: 10000 },
        tone: { type: 'string', enum: ['funny', 'formal', 'sarcastic', 'professional'] },
    },
    required: ['text', 'tone'],
}

const generateAiImageInputSchema: InputSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        prompt: { type: 'string', minLength: 1, maxLength: 4000 },
    },
    required: ['prompt'],
}

const publishMcpPostInputSchema: InputSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        text: { type: 'string', minLength: 1, maxLength: 10000 },
        imageUrl: { type: 'string', minLength: 1, maxLength: 20000 },
    },
    required: ['text'],
}

const ajv = new Ajv({
    strict: true,
    allErrors: true,
    removeAdditional: false,
    coerceTypes: false,
})

const toolValidators: Record<ToolName, ValidateFunction> = {
    get_latest_posts: ajv.compile(getLatestPostsInputSchema),
    adjust_text_tone: ajv.compile(adjustTextToneInputSchema),
    generate_ai_image: ajv.compile(generateAiImageInputSchema),
    publish_mcp_post: ajv.compile(publishMcpPostInputSchema),
}

const serviceStatus: AiStatusResource = {
    openai: createServiceStatus(config.has('openai.apiKey') && !!config.get<string>('openai.apiKey').trim()),
    gemini: createServiceStatus(config.has('gemini.apiKey') && !!config.get<string>('gemini.apiKey').trim()),
}

const tools: Tool[] = [
    {
        name: 'get_latest_posts',
        title: 'Get Latest Posts',
        description: 'Fetch the latest posts from the platform feed using limit/offset pagination.',
        inputSchema: getLatestPostsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
    },
    {
        name: 'adjust_text_tone',
        title: 'Adjust Text Tone',
        description: 'Rewrite post text tone using the existing Gemini integration.',
        inputSchema: adjustTextToneInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
    },
    {
        name: 'generate_ai_image',
        title: 'Generate AI Image',
        description: 'Generate an image from prompt using the existing OpenAI integration and return a persisted URL.',
        inputSchema: generateAiImageInputSchema,
    },
    {
        name: 'publish_mcp_post',
        title: 'Publish MCP Post',
        description: 'Create a new post in MySQL and broadcast the live update through Socket.io.',
        inputSchema: publishMcpPostInputSchema,
    },
]

const resources: ListResourcesResult['resources'] = [
    {
        uri: LATEST_POSTS_RESOURCE_URI,
        name: 'latest-posts',
        title: 'Latest Posts',
        description: 'Read-only markdown snapshot of the 10 most recent posts.',
        mimeType: 'text/markdown',
    },
    {
        uri: AI_STATUS_RESOURCE_URI,
        name: 'ai-status',
        title: 'AI Service Status',
        description: 'Connectivity and rate-limit state for OpenAI and Gemini wrappers.',
        mimeType: 'application/json',
    },
]

const server = new Server(
    {
        name: MCP_SERVER_NAME,
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {
                listChanged: false,
            },
            resources: {
                listChanged: false,
                subscribe: false,
            },
        },
        instructions: 'BetterX MCP server for posts feed, AI tone/image generation, and publishing.',
    },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))

server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources }))

server.setRequestHandler(ReadResourceRequestSchema, async (request): Promise<ReadResourceResult> => {
    const { uri } = request.params

    if (uri === LATEST_POSTS_RESOURCE_URI) {
        try {
            const latestPosts = await fetchLatestPosts(10, 0)
            return {
                contents: [
                    {
                        uri,
                        mimeType: 'text/markdown',
                        text: renderLatestPostsMarkdown(latestPosts),
                    },
                ],
            }
        } catch (error) {
            return {
                contents: [
                    {
                        uri,
                        mimeType: 'text/markdown',
                        text: `# Latest Posts\n\nUnable to load latest posts.\n\nError: ${formatUnknownError(error)}`,
                    },
                ],
            }
        }
    }

    if (uri === AI_STATUS_RESOURCE_URI) {
        return {
            contents: [
                {
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify({
                        openai: withConnectivity(serviceStatus.openai),
                        gemini: withConnectivity(serviceStatus.gemini),
                        socketBridgeConnected: socket.connected,
                    }, null, 2),
                },
            ],
        }
    }

    throw new Error(`Unknown resource URI: ${uri}`)
})

server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const toolName = request.params.name as ToolName
    const rawArgs = request.params.arguments ?? {}

    try {
        switch (toolName) {
            case 'get_latest_posts': {
                const args = validateToolArgs<GetLatestPostsArgs>('get_latest_posts', rawArgs)
                const limit = args.limit ?? DEFAULT_LIMIT
                const offset = args.offset ?? DEFAULT_OFFSET
                const posts = await fetchLatestPosts(limit, offset)
                return successResult({ limit, offset, count: posts.length, posts })
            }

            case 'adjust_text_tone': {
                const args = validateToolArgs<AdjustTextToneArgs>('adjust_text_tone', rawArgs)
                const rewritten = await rewriteTextWithGemini(args.text, args.tone)
                return successResult({ tone: args.tone, original: args.text, rewritten })
            }

            case 'generate_ai_image': {
                const args = validateToolArgs<GenerateAiImageArgs>('generate_ai_image', rawArgs)
                const result = await generateImageWithOpenAi(args.prompt)
                return successResult(result)
            }

            case 'publish_mcp_post': {
                const args = validateToolArgs<PublishMcpPostArgs>('publish_mcp_post', rawArgs)
                const post = await publishPostAndBroadcast(args)
                return successResult(post)
            }

            default:
                return errorResult(`Unknown tool: ${request.params.name}`)
        }
    } catch (error) {
        if (error instanceof PublishBroadcastError) {
            return errorResult(error.message, { postId: error.postId })
        }

        return errorResult(formatUnknownError(error))
    }
})

async function fetchLatestPosts(limit: number, offset: number): Promise<LatestPostView[]> {
    const contentServiceUrl = config.get<string>('services.content.url')
    const response = await fetch(`${contentServiceUrl}/posts?limit=${limit}&offset=${offset}`, {
        headers: { Authorization: await getServiceAuthHeader() },
    })

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'failed to fetch latest posts' })) as { message?: string }
        throw new Error(errorBody.message ?? 'failed to fetch latest posts')
    }

    interface ContentServicePost {
        id: string
        title: string
        body: string
        imageUrl: string | null
        createdAt: string
        user: { id: string; name: string; username: string; avatarUrl: string | null } | null
        likes?: unknown[]
        comments?: unknown[]
    }

    const posts = await response.json() as ContentServicePost[]

    return posts.map((post) => ({
        id: post.id,
        title: post.title,
        body: post.body,
        imageUrl: post.imageUrl ?? null,
        createdAt: post.createdAt,
        user: post.user
            ? {
                id: post.user.id,
                name: post.user.name,
                username: post.user.username,
                avatarUrl: post.user.avatarUrl ?? null,
            }
            : null,
        likeCount: post.likes?.length ?? 0,
        commentCount: post.comments?.length ?? 0,
    }))
}

async function getServiceAuthHeader(): Promise<string> {
    const authorId = await resolveAuthorId()
    const token = sign({ id: authorId }, config.get<string>('app.encryptionKey'))
    return `Bearer ${token}`
}

function getSystemAuthHeader(): string {
    const token = sign({ id: 'system' }, config.get<string>('app.encryptionKey'))
    return `Bearer ${token}`
}

async function persistImageToMediaService(source: string): Promise<string> {
    const mediaServiceUrl = config.get<string>('services.media.url')
    const response = await fetch(`${mediaServiceUrl}/media/persist-image`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: await getServiceAuthHeader(),
        },
        body: JSON.stringify({ type: 'post-image', source }),
    })

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'image persistence failed' })) as { message?: string }
        throw new Error(errorBody.message ?? 'image persistence failed')
    }

    const { url } = await response.json() as { url: string }
    return url
}

async function rewriteTextWithGemini(text: string, tone: Tone): Promise<string> {
    try {
        const aiServiceUrl = config.get<string>('services.ai.url')
        const response = await fetch(`${aiServiceUrl}/drafts/rewrite-tone`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: await getServiceAuthHeader(),
            },
            body: JSON.stringify({ text, tone }),
        })

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ message: 'tone rewrite failed' })) as { message?: string }
            throw new Error(errorBody.message ?? 'tone rewrite failed')
        }

        const { rewritten } = await response.json() as { rewritten: string }
        if (!rewritten) {
            throw new Error('Gemini returned an empty response.')
        }

        markServiceSuccess('gemini')
        return rewritten
    } catch (error) {
        markServiceFailure('gemini', error)
        throw normalizeToolError('Gemini tone rewrite failed', error)
    }
}

async function generateImageWithOpenAi(prompt: string): Promise<{ prompt: string; imageUrl: string }> {
    try {
        const aiServiceUrl = config.get<string>('services.ai.url')
        const response = await fetch(`${aiServiceUrl}/drafts/generate-image-openai`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: await getServiceAuthHeader(),
            },
            body: JSON.stringify({ prompt }),
        })

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ message: 'image generation failed' })) as { message?: string }
            throw new Error(errorBody.message ?? 'image generation failed')
        }

        const { source } = await response.json() as { source: string }
        if (!source) {
            throw new Error('OpenAI returned no image payload.')
        }

        const imageUrl = await persistImageToMediaService(source)
        markServiceSuccess('openai')

        return { prompt, imageUrl }
    } catch (error) {
        markServiceFailure('openai', error)
        throw normalizeToolError('OpenAI image generation failed', error)
    }
}

async function publishPostAndBroadcast(args: PublishMcpPostArgs): Promise<{ postId: string; title: string; text: string; imageUrl: string | null; broadcasted: boolean }> {
    const persistedImageUrl = args.imageUrl
        ? await persistImageToMediaService(args.imageUrl)
        : undefined

    const title = buildTitle(args.text)

    const contentServiceUrl = config.get<string>('services.content.url')
    const authHeader = await getServiceAuthHeader()
    const response = await fetch(`${contentServiceUrl}/posts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
        },
        body: JSON.stringify({ title, body: args.text, imageUrl: persistedImageUrl }),
    })

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'post creation failed' })) as { message?: string }
        throw new Error(errorBody.message ?? 'post creation failed')
    }

    const post = await response.json() as { id: string; body: string; imageUrl: string | null }

    // content-service creates the post and broadcasts NEW_POST over its own Socket.io connection.
    return {
        postId: post.id,
        title,
        text: post.body,
        imageUrl: post.imageUrl ?? null,
        broadcasted: true,
    }
}

async function resolveAuthorId(): Promise<string> {
    const configuredUserId = config.has('mcp.userId') ? config.get<string>('mcp.userId').trim() : ''

    const identityServiceUrl = config.get<string>('services.identity.url')
    const response = await fetch(`${identityServiceUrl}/users`, {
        headers: { Authorization: getSystemAuthHeader() },
    })

    if (!response.ok) {
        throw new Error('Failed to fetch users from identity-service')
    }

    const users = await response.json() as Array<{ id: string; createdAt: string }>

    if (configuredUserId) {
        const user = users.find(u => u.id === configuredUserId)
        if (!user) {
            throw new Error(`Configured mcp.userId does not exist: ${configuredUserId}`)
        }

        return user.id
    }

    const fallbackUser = [...users].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]
    if (!fallbackUser) {
        throw new Error('No users exist. Create at least one user or set BETTERX_MCP_USER_ID.')
    }

    return fallbackUser.id
}

function renderLatestPostsMarkdown(posts: LatestPostView[]): string {
    const lines: string[] = ['# Latest Posts', '']

    if (posts.length === 0) {
        lines.push('No posts found.')
        return lines.join('\n')
    }

    for (const post of posts) {
        const username = post.user?.username ?? 'unknown'
        lines.push(`## ${escapeMarkdown(post.title)}`)
        lines.push(`- id: ${post.id}`)
        lines.push(`- author: @${escapeMarkdown(username)}`)
        lines.push(`- createdAt: ${post.createdAt}`)
        lines.push(`- likes: ${post.likeCount}`)
        lines.push(`- comments: ${post.commentCount}`)
        if (post.imageUrl) {
            lines.push(`- image: ${post.imageUrl}`)
        }
        lines.push('')
        lines.push(post.body)
        lines.push('')
    }

    return lines.join('\n')
}

function validateToolArgs<T>(toolName: ToolName, args: unknown): T {
    const validator = toolValidators[toolName]
    const payload = (args ?? {}) as Record<string, unknown>

    if (!validator(payload)) {
        const details = ajv.errorsText(validator.errors, { separator: '; ' })
        throw new Error(`Invalid arguments for ${toolName}: ${details}`)
    }

    return payload as T
}

function successResult(data: Record<string, unknown>): CallToolResult {
    return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
    }
}

function errorResult(message: string, details?: Record<string, unknown>): CallToolResult {
    const payload = details ? { message, ...details } : { message }

    return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
    }
}

function buildTitle(text: string): string {
    const normalized = text.replace(/\s+/g, ' ').trim()
    if (!normalized) {
        return 'Untitled post'
    }

    return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized
}

function escapeMarkdown(value: string): string {
    return value.replace(/[\\`*_{}[\]()#+\-.!|]/g, '\\$&')
}

function createServiceStatus(configured: boolean): AiServiceStatus {
    return {
        configured,
        connectivity: configured ? 'unknown' : 'not_configured',
        lastSuccessAt: null,
        lastErrorAt: null,
        lastError: null,
        rateLimit: {
            isLimited: false,
            consecutive429: 0,
            lastRateLimitAt: null,
        },
    }
}

function markServiceSuccess(service: keyof AiStatusResource): void {
    const status = serviceStatus[service]
    const now = new Date().toISOString()

    status.lastSuccessAt = now
    status.lastError = null
    status.lastErrorAt = null
    status.rateLimit.isLimited = false
    status.rateLimit.consecutive429 = 0
}

function markServiceFailure(service: keyof AiStatusResource, error: unknown): void {
    const status = serviceStatus[service]
    const now = new Date().toISOString()

    status.lastErrorAt = now
    status.lastError = formatUnknownError(error)

    if (isRateLimitError(error)) {
        status.rateLimit.isLimited = true
        status.rateLimit.consecutive429 += 1
        status.rateLimit.lastRateLimitAt = now
        return
    }

    status.rateLimit.isLimited = false
    status.rateLimit.consecutive429 = 0
}

function withConnectivity(status: AiServiceStatus): AiServiceStatus {
    return {
        ...status,
        connectivity: deriveConnectivity(status),
    }
}

function deriveConnectivity(status: AiServiceStatus): AiServiceStatus['connectivity'] {
    if (!status.configured) {
        return 'not_configured'
    }

    if (status.rateLimit.isLimited) {
        return 'rate_limited'
    }

    if (status.lastSuccessAt) {
        return 'ok'
    }

    if (status.lastErrorAt) {
        return 'error'
    }

    return 'unknown'
}

function normalizeToolError(prefix: string, error: unknown): Error {
    return new Error(`${prefix}: ${formatUnknownError(error)}`)
}

function isRateLimitError(error: unknown): boolean {
    const status = (error as { status?: number; code?: string })?.status
    const code = (error as { status?: number; code?: string })?.code
    return status === 429 || code === 'rate_limit_exceeded'
}

function formatUnknownError(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }

    if (typeof error === 'object' && error !== null) {
        return JSON.stringify(error)
    }

    return String(error)
}

async function start(): Promise<void> {
    const transport = new StdioServerTransport()
    await server.connect(transport)
}

start().catch((error) => {
    process.stderr.write(`[${MCP_SERVER_NAME}] failed to start: ${formatUnknownError(error)}\n`)
    process.exit(1)
})
