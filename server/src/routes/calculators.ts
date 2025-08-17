import { Router } from 'express'
import { 
  getStaffOptions, 
  getPayRate, 
  getCarpetRate 
} from '../controllers/calculatorsController'

const router = Router()

// Calculator routes
router.get('/staff-options', getStaffOptions)
router.get('/pay-rate', getPayRate)
router.get('/carpet-rate', getCarpetRate)

export default router
