import { Router } from 'express'
import { suggestUsers } from '../controllers/recommendations/controller'

const recommendationsRouter = Router()
recommendationsRouter.get('/suggested-users', suggestUsers)

export default recommendationsRouter
