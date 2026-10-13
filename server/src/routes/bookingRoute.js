import { Router } from 'express'
import { getMyBookings, updateBookingStatus } from '../controllers/bookingController.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = Router()

router.get('/', asyncHandler(getMyBookings))
router.patch('/:id/status', asyncHandler(updateBookingStatus))

export default router