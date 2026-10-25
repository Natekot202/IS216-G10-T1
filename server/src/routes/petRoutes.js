import { Router } from 'express'
import { requireOwner } from '../middleware/authMiddleware.js'

import {
  getPets,
  createPet,
  updatePet,
  deletePet
} from '../controllers/petController.js'
import asyncHandler from '../middleware/asyncHandler.js'
import { uploadPhoto } from '../middleware/upload.js'

const router = Router()

router.get('/', requireOwner, asyncHandler(getPets))
router.post('/', requireOwner, uploadPhoto, asyncHandler(createPet))
router.delete('/:id', requireOwner, asyncHandler(deletePet))
router.put('/:id', requireOwner, uploadPhoto, asyncHandler(updatePet))

export default router
