import { Router } from 'express'
import { getFollowers, getFollowing, getFollowersByUserId, getFollowingByUserId, follow, unfollow } from '../controllers/follows/controller'

const followsRouter = Router()

followsRouter.get('/followers', getFollowers)
followsRouter.get('/following', getFollowing)
followsRouter.get('/followers/:userId', getFollowersByUserId)
followsRouter.get('/following/:userId', getFollowingByUserId)
followsRouter.post('/follow/:followeeId', follow)
followsRouter.post('/unfollow/:followeeId', unfollow)

export default followsRouter
