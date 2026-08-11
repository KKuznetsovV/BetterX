import { Router, json } from 'express'
import { login, signup } from '../controllers/auth/controller'
import { loginValidator, signupValidator } from '../controllers/auth/validator'
import validate from '../middlewares/validation'

const authRouter = Router()
authRouter.use('/', json())
authRouter.post('/signup', validate({ body: signupValidator }), signup)
authRouter.post('/login', validate({ body: loginValidator }), login)

export default authRouter
