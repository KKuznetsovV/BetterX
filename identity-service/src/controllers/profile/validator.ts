import Joi from 'joi';


export const updateProfileValidator = Joi.object({
    name: Joi.string().min(2).max(50),
    username: Joi.string().min(3).max(30),
    password: Joi.string().min(6),
    avatarUrl: Joi.string().allow('', null),
});
