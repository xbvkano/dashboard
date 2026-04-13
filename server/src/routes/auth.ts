import { Router } from 'express'
import { getCurrentUser, login, patchCurrentUser } from '../controllers/authController'

const router = Router()

// Auth routes
router.post('/login', login)
router.get('/users/me', getCurrentUser)
router.patch('/users/me', patchCurrentUser)

export default router
