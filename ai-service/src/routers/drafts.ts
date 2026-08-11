import { Router, json } from 'express'
import { improve, generateImage, generateAvatar, checkProfanity, rewriteTone, generateImageOpenAi } from '../controllers/drafts/controller'
import { improveValidator, generateImageValidator, generateAvatarValidator, profanityCheckValidator, rewriteToneValidator, generateImageOpenAiValidator } from '../controllers/drafts/validator'
import validate from '../middlewares/validation'

const draftsRouter = Router()
draftsRouter.use('/', json())
draftsRouter.post('/improve', validate({ body: improveValidator }), improve)
draftsRouter.post('/generate-image', validate({ body: generateImageValidator }), generateImage)
draftsRouter.post('/generate-avatar', validate({ body: generateAvatarValidator }), generateAvatar)
draftsRouter.post('/check-profanity', validate({ body: profanityCheckValidator }), checkProfanity)
draftsRouter.post('/rewrite-tone', validate({ body: rewriteToneValidator }), rewriteTone)
draftsRouter.post('/generate-image-openai', validate({ body: generateImageOpenAiValidator }), generateImageOpenAi)

export default draftsRouter
