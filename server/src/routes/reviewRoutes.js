import { Router } from 'express'
import asyncHandler from '../middleware/asyncHandler.js'
import { requireOwner, requireLogin } from '../middleware/authMiddleware.js'
import { createReview, getBookingReview } from '../controllers/reviewController.js'

const router = Router()

router.post('/', requireOwner, asyncHandler(createReview))
router.get('/booking/:bookingId', requireLogin, asyncHandler(getBookingReview))

export default router