import Joi from 'joi'

export const persistImageValidator = Joi.object({
    type: Joi.string().valid('post-image', 'avatar').required(),
    source: Joi.string().required()
})
