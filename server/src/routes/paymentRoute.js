import { Router } from 'express'
import { createPayment, getMyPayments } from '../controllers/paymentController.js'
import { requireOwner, requireLogin } from '../middleware/authMiddleware.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = Router()

router.post('/', requireOwner, asyncHandler(createPayment))
router.get('/mine', requireLogin, asyncHandler(getMyPayments))

export default router