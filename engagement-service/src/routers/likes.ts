import { Router, json } from 'express'
import { likePost, unlikePost, likeComment, unlikeComment, getLikesBatch } from '../controllers/likes/controller'

const likesRouter = Router()
likesRouter.use('/', json())
likesRouter.get('/batch', getLikesBatch)
likesRouter.post('/post/:postId', likePost)
likesRouter.delete('/post/:postId', unlikePost)
likesRouter.post('/comment/:commentId', likeComment)
likesRouter.delete('/comment/:commentId', unlikeComment)

export default likesRouter
