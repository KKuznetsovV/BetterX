import Joi from 'joi'

const IMPROVE_STYLES = ['professional', 'funny', 'sad', 'casual', 'inspirational'] as const

export const improveValidator = Joi.object({
    body: Joi.string().required(),
    style: Joi.string().valid(...IMPROVE_STYLES).required()
})

export const generateImageValidator = Joi.object({
    prompt: Joi.string().required()
})

export const generateAvatarValidator = Joi.object({
    prompt: Joi.string().min(10).required()
})

export const profanityCheckValidator = Joi.object({
    title: Joi.string().allow('').optional(),
    body: Joi.string().allow('').optional(),
    explicitContentEnabled: Joi.boolean().optional(),
}).or('title', 'body')

const TONES = ['funny', 'formal', 'sarcastic', 'professional'] as const

export const rewriteToneValidator = Joi.object({
    text: Joi.string().min(1).max(10000).required(),
    tone: Joi.string().valid(...TONES).required()
})

export const generateImageOpenAiValidator = Joi.object({
    prompt: Joi.string().min(1).max(4000).required()
})
