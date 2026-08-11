import { NextFunction, Request, Response } from 'express'
import { randomUUID } from 'crypto'
import config from 'config'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import openai from '../../ai/ai'
import { getGemini } from '../../ai/gemini'
import s3Client, { buildPublicObjectUrl } from '../../aws/s3'
import { checkProfanityWithOpenAI } from '../../moderation/moderation'

type ImproveStyle = 'professional' | 'funny' | 'sad' | 'casual' | 'inspirational'

type GenerateImageResponse = { url: string; revisedPrompt: string }

const STYLE_PROMPTS: Record<ImproveStyle, string> = {
    professional: `You are a professional editor. Correct grammar and spelling, enhance the language to sound polished and professional, improve sentence structure. Keep the original meaning intact. Respond with only the improved text, no explanations.`,
    funny: `You are a witty comedy writer. Rewrite the text to be humorous, playful and entertaining while keeping the core message. Add jokes or wordplay where appropriate. Respond with only the rewritten text, no explanations.`,
    sad: `You are a heartfelt emotional writer. Rewrite the text with a melancholic, sentimental tone evoking feelings of longing or emotion. Keep the core message but make it touching. Respond with only the rewritten text, no explanations.`,
    casual: `You are a friendly, relaxed writer. Rewrite the text in a casual conversational tone as if talking to a close friend. Use everyday language, contractions, and a warm personal touch. Respond with only the rewritten text, no explanations.`,
    inspirational: `You are a motivational speaker. Rewrite the text to be uplifting, energizing and inspiring. Use powerful language that encourages and motivates the reader. Respond with only the rewritten text, no explanations.`,
}

export async function improve(request: Request<{}, {}, { body: string; style: ImproveStyle }>, response: Response, next: NextFunction) {
    try {
        const { body, style } = request.body
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: STYLE_PROMPTS[style] },
                { role: 'user', content: body }
            ]
        })
        const improved = completion.choices[0].message.content ?? ''
        response.json({ original: body, improved })
    } catch (e) {
        next(e)
    }
}

export async function generateImage(request: Request<{}, {}, { prompt: string }>, response: Response, next: NextFunction) {
    try {
        const { prompt } = request.body
        const result = await generateGeminiImage(prompt, config.get<string>('aws.bucket'))
        response.json(result)
    } catch (e) {
        const err = e as { status?: number; message?: string }
        next({ status: err.status ?? 500, message: err.message ?? 'Image generation failed' })
    }
}

export async function generateAvatar(request: Request<{}, {}, { prompt: string }>, response: Response, next: NextFunction) {
    try {
        const moderation = await checkProfanityWithOpenAI({ body: request.body.prompt })
        if (moderation.action === 'hard_block' || moderation.hasProfanity) {
            return next({
                status: 422,
                message: moderation.userMessage,
                reasons: moderation.reasons,
                tier: moderation.tier,
                category: moderation.category,
            })
        }

        const prompt = moderation.filtered.body ?? request.body.prompt
        const result = await generateGeminiImage(prompt, config.get<string>('aws.avatarsBucket'))
        response.json(result)
    } catch (e) {
        const err = e as { status?: number; message?: string }
        next({ status: err.status ?? 500, message: err.message ?? 'Avatar generation failed' })
    }
}

export async function checkProfanity(request: Request<{}, {}, { title?: string; body?: string; explicitContentEnabled?: boolean }>, response: Response, next: NextFunction) {
    try {
        const result = await checkProfanityWithOpenAI(request.body)
        response.json(result)
    } catch (e) {
        next(e)
    }
}

type Tone = 'funny' | 'formal' | 'sarcastic' | 'professional'

export async function rewriteTone(request: Request<{}, {}, { text: string; tone: Tone }>, response: Response, next: NextFunction) {
    try {
        const { text, tone } = request.body
        const prompt = [
            'Rewrite the provided text and return only the rewritten text.',
            `Tone: ${tone}.`,
            'Preserve the original message and language when possible.',
            'Text:',
            text,
        ].join('\n')

        const gemini = await getGemini()
        const result = await gemini.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseModalities: ['TEXT'] },
        })

        const rewritten = ((result as unknown as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts ?? [])
            .map(part => part.text ?? '')
            .join('')
            .trim()

        if (!rewritten) {
            return next({ status: 500, message: 'Gemini returned an empty response.' })
        }

        response.json({ rewritten })
    } catch (e) {
        const err = e as { status?: number; message?: string }
        next({ status: err.status ?? 500, message: err.message ?? 'Tone rewrite failed' })
    }
}

export async function generateImageOpenAi(request: Request<{}, {}, { prompt: string }>, response: Response, next: NextFunction) {
    try {
        const { prompt } = request.body
        const result = await openai.images.generate({
            model: 'gpt-image-1',
            prompt,
            size: '1024x1024',
        })

        const firstImage = result.data?.[0]
        const source = firstImage?.url ?? (firstImage?.b64_json ? `data:image/png;base64,${firstImage.b64_json}` : null)

        if (!source) {
            return next({ status: 500, message: 'OpenAI returned no image payload.' })
        }

        response.json({ prompt, source })
    } catch (e) {
        const err = e as { status?: number; message?: string }
        next({ status: err.status ?? 500, message: err.message ?? 'Image generation failed' })
    }
}

async function generateGeminiImage(prompt: string, bucket: string): Promise<GenerateImageResponse> {
    const gemini = await getGemini()

    const result = await gemini.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseModalities: ['IMAGE', 'TEXT'] },
    })

    const parts = result.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData?.data)
    if (!imagePart?.inlineData?.data) {
        throw { status: 500, message: 'Gemini returned no image' }
    }

    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64')
    const key = `${randomUUID()}.png`

    await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: imageBuffer,
        ContentType: 'image/png',
    }))

    const url = buildPublicObjectUrl(bucket, key)
    return { url, revisedPrompt: prompt }
}
