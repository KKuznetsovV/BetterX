import Joi from 'joi';

export const newPostValidator = Joi.object({
  title: Joi.string().min(10).required(),
  body: Joi.string().min(20).required(),
  imageUrl: Joi.string().uri().allow('', null).optional(),
});

export const postParamsValidator = Joi.object({
    postId: Joi.string().uuid()
});

export const updatePostValidator = Joi.object({
  title: Joi.string().min(10).required(),
  body: Joi.string().min(20).required(),
  imageUrl: Joi.string().uri().allow('', null).optional(),
});

export const userParamsValidator = Joi.object({
    userId: Joi.string().uuid().required()
});

export const listPostsQueryValidator = Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(10),
    offset: Joi.number().integer().min(0).default(0),
});
