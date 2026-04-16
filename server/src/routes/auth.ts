import { Router } from 'express'
import { getCurrentUser, login, patchCurrentUser, refreshAccessToken } from '../controllers/authController'

const router = Router()

// Auth routes
router.post('/login', login)
router.post('/auth/refresh', refreshAccessToken)
router.get('/users/me', getCurrentUser)
router.patch('/users/me', patchCurrentUser)

export default router
