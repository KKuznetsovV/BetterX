import Joi from 'joi';

export const loginValidator = Joi.object({
    username: Joi.string().min(6).alphanum().required(),
    password: Joi.string().min(6).required(),
});

export const signupValidator = loginValidator.keys({
    name: Joi.string().required(),
    avatarUrl: Joi.string().uri().allow('', null).optional(),
});
