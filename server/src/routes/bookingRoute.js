import { Router } from 'express'
import { getMyBookings } from '../controllers/bookingController.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = Router()

router.get('/', asyncHandler(getMyBookings))

export default router