import { Router } from 'express'
import {getSitters} from '../controllers/sitterController.js'

const router = Router()

router.get('/', getSitters)


export default router