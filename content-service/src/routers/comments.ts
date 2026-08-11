import { json, Router } from 'express'
import { createComment, updateComment, deleteComment } from '../controllers/comments/controller'
import { newCommentParamsValidator, newCommentValidator, commentParamsValidator, updateCommentValidator } from '../controllers/comments/validator'
import validate from '../middlewares/validation'
import profanityGuard from '../middlewares/profanity'

const commentsRouter = Router()

commentsRouter.use('/', json())
commentsRouter.post('/:postId', validate({ params: newCommentParamsValidator, body: newCommentValidator }), profanityGuard(['body']), createComment)
commentsRouter.patch('/:commentId', validate({ params: commentParamsValidator, body: updateCommentValidator }), profanityGuard(['body']), updateComment)
commentsRouter.delete('/:commentId', validate({ params: commentParamsValidator }), deleteComment)

export default commentsRouter
