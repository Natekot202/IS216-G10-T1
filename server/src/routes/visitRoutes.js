import { Router } from 'express'
import asyncHandler from '../middleware/asyncHandler.js'
import { requireLogin, requireSitter } from '../middleware/authMiddleware.js'
import { uploadPhotos } from '../middleware/upload.js'
import { getTodaySessions, startVisit, setTaskCount, endVisit } from '../controllers/visitController.js'

const router = Router()

router.get('/today', requireLogin, asyncHandler(getTodaySessions))
router.post('/booking/:bookingId/start', requireSitter, asyncHandler(startVisit))
router.patch('/:visitId/tasks/:taskId', requireSitter, asyncHandler(setTaskCount))
router.post('/:visitId/end', requireSitter, uploadPhotos, asyncHandler(endVisit))

export default router