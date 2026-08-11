import type { NextFunction, Request, Response } from 'express'
import { ObjectSchema } from 'joi'

interface Validators {
    body?: ObjectSchema
    params?: ObjectSchema
    query?: ObjectSchema
}

export default function validate(validators: Validators) {
    return async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (validators.body)   request.body   = await validators.body.validateAsync(request.body)
            if (validators.params) request.params = await validators.params.validateAsync(request.params)
            if (validators.query)  Object.assign(request.query, await validators.query.validateAsync(request.query))
            next()
        } catch (e) {
            next({
                status: 422,
                message: e.message || 'unprocessable entity'
            })
        }
    }
}
