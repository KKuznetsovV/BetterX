import Joi from 'joi'

export const newCommentValidator = Joi.object({
    body: Joi.string().min(10).required(),
    parentId: Joi.string().uuid().allow(null).optional()
})

export const newCommentParamsValidator = Joi.object({
    postId: Joi.string().uuid().required()
})

export const updateCommentValidator = Joi.object({
    body: Joi.string().min(10).required()
})

export const commentParamsValidator = Joi.object({
    commentId: Joi.string().uuid().required()
})
