import { Router } from 'express'
import { requireLogin, requireSitter } from '../middleware/authMiddleware.js'
import asyncHandler from '../middleware/asyncHandler.js'
import {
  createWalk,
  getWalk,
  startWalk,
  reportDeviation,
  reportBackOnRoute,
  finishWalk,
  endWalkEarly
} from '../controllers/walkController.js'

// A sitter's walks along an owner's route (the routes themselves are in walkRoutes.js)
const router = Router()

router.post('/', requireSitter, asyncHandler(createWalk))
router.get('/:id', requireLogin, asyncHandler(getWalk))
router.post('/:id/start', requireSitter, asyncHandler(startWalk))
router.post('/:id/deviations', requireSitter, asyncHandler(reportDeviation))
router.post('/:id/back-on-route', requireSitter, asyncHandler(reportBackOnRoute))
router.post('/:id/finish', requireSitter, asyncHandler(finishWalk))
router.post('/:id/end-early', requireSitter, asyncHandler(endWalkEarly))

export default router
