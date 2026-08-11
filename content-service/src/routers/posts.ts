import { Router, json } from 'express'
import { createPost, deletePost, getAllPosts, getMyPosts, getPost, getUserPosts, updatePost } from '../controllers/posts/controller'
import { listPostsQueryValidator, newPostValidator, postParamsValidator, updatePostValidator, userParamsValidator } from '../controllers/posts/validator'
import validate from '../middlewares/validation'
import profanityGuard from '../middlewares/profanity'

const postsRouter = Router()

postsRouter.use('/', json({ limit: '10mb' }))
postsRouter.get('/', validate({ query: listPostsQueryValidator }), getAllPosts)
postsRouter.get('/mine', getMyPosts)
postsRouter.get('/user/:userId', validate({ params: userParamsValidator }), getUserPosts)
postsRouter.get('/:postId', validate({ params: postParamsValidator }), getPost)
postsRouter.post('/', validate({ body: newPostValidator }), profanityGuard(['title', 'body']), createPost)
postsRouter.patch('/:postId', validate({ params: postParamsValidator, body: updatePostValidator }), profanityGuard(['title', 'body']), updatePost)
postsRouter.delete('/:postId', validate({ params: postParamsValidator }), deletePost)

export default postsRouter
