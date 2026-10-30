import { Router } from 'express'
import { createCheckout, confirmCheckout, cancelCheckout, getMyPayments } from '../controllers/paymentController.js'
import { requireOwner, requireLogin } from '../middleware/authMiddleware.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = Router()

router.post('/checkout', requireOwner, asyncHandler(createCheckout))
router.post('/confirm', requireOwner, asyncHandler(confirmCheckout))
router.post('/:id/cancel', requireOwner, asyncHandler(cancelCheckout))
router.get('/mine', requireLogin, asyncHandler(getMyPayments))

export default router