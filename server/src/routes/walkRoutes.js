import { Router } from 'express'
import { requireOwner } from '../middleware/authMiddleware.js'
import asyncHandler from '../middleware/asyncHandler.js'
import {
  getMyWalkRoutes,
  getWalkRouteById,
  createWalkRoute,
  updateWalkRoute,
  deleteWalkRoute
} from '../controllers/walkRouteController.js'

const router = Router()

router.get('/', requireOwner, asyncHandler(getMyWalkRoutes))
router.get('/:id', requireOwner, asyncHandler(getWalkRouteById))
router.post('/', requireOwner, asyncHandler(createWalkRoute))
router.patch('/:id', requireOwner, asyncHandler(updateWalkRoute))
router.delete('/:id', requireOwner, asyncHandler(deleteWalkRoute))

export default router
