import { Router } from 'express'
import { 
  getRoot, 
  getUsers, 
  getAdmins, 
  getMonthInfo 
} from '../controllers/basicController'

const router = Router()

// Basic routes
router.get('/', getRoot)
router.get('/users', getUsers)
router.get('/admins', getAdmins)
router.get('/month-info', getMonthInfo)

export default router
