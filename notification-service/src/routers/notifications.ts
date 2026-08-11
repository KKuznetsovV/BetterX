import { Router, json } from 'express'
import { getNotifications, markAllRead, markOneRead } from '../controllers/notifications/controller'

const notificationsRouter = Router()
notificationsRouter.use('/', json())
notificationsRouter.get('/', getNotifications)
notificationsRouter.patch('/read', markAllRead)
notificationsRouter.patch('/:notificationId/read', markOneRead)

export default notificationsRouter
