import { Router } from 'express'
import asyncHandler from '../middleware/asyncHandler.js'
import { requireLogin } from '../middleware/authMiddleware.js'
import { getAllUsers, getPublicProfile, getUserPets, getUserReviews, updateMyProfile, updateMyPicture, removeMyPicture } from '../controllers/userController.js'
import { uploadPhoto } from '../middleware/upload.js'


const router = Router()

router.get('/', getAllUsers)
router.get('/:id', asyncHandler(getPublicProfile))
router.get('/:id/pets', requireLogin, asyncHandler(getUserPets))
router.get('/:id/reviews', asyncHandler(getUserReviews))
router.put('/me', requireLogin, asyncHandler(updateMyProfile))
router.put('/me/picture', requireLogin, uploadPhoto, asyncHandler(updateMyPicture))
router.delete('/me/picture', requireLogin, asyncHandler(removeMyPicture))

export default router