import { Router, json } from 'express'
import { updateProfile, deleteProfile } from '../controllers/profile/controller'
import { updateProfileValidator } from '../controllers/profile/validator'
import validate from '../middlewares/validation'
const profileRouter = Router()

profileRouter.use('/', json({ limit: '10mb' }))
profileRouter.patch('/account', validate({ body: updateProfileValidator }), updateProfile)
profileRouter.delete('/account', deleteProfile)
export default profileRouter
