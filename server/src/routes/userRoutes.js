import { Router } from 'express'
import asyncHandler from '../middleware/asyncHandler.js'
import { requireLogin, requireSitter } from '../middleware/authMiddleware.js'
import { getAllUsers, getPublicProfile, getUserPets, getUserReviews, updateMyProfile, updateMyPicture, removeMyPicture, addGalleryPhotos, removeGalleryPhoto, getUserBadges, getReviewsGiven } from '../controllers/userController.js'
import { uploadPhoto, uploadGallery } from '../middleware/upload.js'


const router = Router()

router.get('/', getAllUsers)
router.get('/:id', asyncHandler(getPublicProfile))
router.get('/:id/pets', requireLogin, asyncHandler(getUserPets))
router.get('/:id/reviews', asyncHandler(getUserReviews))
router.get('/:id/reviews-given', requireLogin, asyncHandler(getReviewsGiven))
router.get('/:id/badges', asyncHandler(getUserBadges))
router.put('/me', requireLogin, asyncHandler(updateMyProfile))
router.put('/me/picture', requireLogin, uploadPhoto, asyncHandler(updateMyPicture))
router.delete('/me/picture', requireLogin, asyncHandler(removeMyPicture))
router.post('/me/gallery', requireSitter, uploadGallery, asyncHandler(addGalleryPhotos))
router.delete('/me/gallery/:photoId', requireSitter, asyncHandler(removeGalleryPhoto))

export default router