import { Router } from 'express'
import { postSignup, postLogin, me, logout, changePassword } from '../controllers/authController.js'
import { requireLogin } from '../middleware/authMiddleware.js';
import asyncHandler from '../middleware/asyncHandler.js'

const router = Router()

router.post("/register", postSignup);
router.post("/login", postLogin);
router.get("/me", me);
router.post("/logout", logout);
router.put('/password', requireLogin, asyncHandler(changePassword))

export default router