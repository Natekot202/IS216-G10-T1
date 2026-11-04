import { Router } from 'express'
import asyncHandler from '../middleware/asyncHandler.js'
import { requireLogin, requireSitter, requireOwner } from '../middleware/authMiddleware.js'
import { uploadPhotos } from '../middleware/upload.js'
import {
  getTodaySessions, startVisit, updateLocation, setTaskCount, endVisit, getRecentBookings, getBookingReport
} from '../controllers/visitController.js'

const router = Router()

router.get('/today', requireLogin, asyncHandler(getTodaySessions))
// these two come before the /:visitId routes, so "recent" and "booking" are never read as a visit id
router.get('/recent', requireOwner, asyncHandler(getRecentBookings))
router.get('/booking/:bookingId/report', requireLogin, asyncHandler(getBookingReport))
router.post('/booking/:bookingId/start', requireSitter, asyncHandler(startVisit))
router.post('/:visitId/location', requireSitter, asyncHandler(updateLocation))
router.patch('/:visitId/tasks/:taskId', requireSitter, asyncHandler(setTaskCount))
router.post('/:visitId/end', requireSitter, uploadPhotos, asyncHandler(endVisit))

export default router
