import { Router } from 'express'
import { requireLogin } from '../middleware/authMiddleware.js'
import asyncHandler from '../middleware/asyncHandler.js'
import {
  getMyNotifications,
  getUnreadCount,
  markRead,
  markAllRead
} from '../controllers/notificationController.js'

// Any logged-in user can read their own notifications
const router = Router()

router.get('/', requireLogin, asyncHandler(getMyNotifications))
router.get('/unread-count', requireLogin, asyncHandler(getUnreadCount))
router.patch('/read-all', requireLogin, asyncHandler(markAllRead))
router.patch('/:id/read', requireLogin, asyncHandler(markRead))

export default router
