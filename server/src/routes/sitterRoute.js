import { Router } from 'express'
import { requireOwner } from '../middleware/authMiddleware.js'
import {getSitters} from '../controllers/sitterController.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = Router()

router.get('/', getSitters)
// router.post('/', requireOwner, asyncHandler(createPet))
// router.delete('/:id', requireOwner, asyncHandler(deletePet))

export default router