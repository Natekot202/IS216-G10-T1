import { Router } from 'express'
import asyncHandler from '../middleware/asyncHandler.js'
import { requireLogin } from '../middleware/authMiddleware.js'
import { getPublicProfile, getUserPets, getUserReviews, updateMyProfile } from '../controllers/userController.js'

const router = Router()

router.get('/:id', asyncHandler(getPublicProfile))
router.get('/:id/pets', requireLogin, asyncHandler(getUserPets))
router.get('/:id/reviews', asyncHandler(getUserReviews))
router.put('/me', requireLogin, asyncHandler(updateMyProfile))

export default router