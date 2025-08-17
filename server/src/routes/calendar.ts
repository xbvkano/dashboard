import { Router } from 'express'
import { 
  getMonthInfo, 
  getMonthCounts, 
  getRangeCounts 
} from '../controllers/calendarController'

const router = Router()

// Calendar routes
router.get('/month-info', getMonthInfo)
router.get('/appointments/month-counts', getMonthCounts)
router.get('/appointments/range-counts', getRangeCounts)

export default router
