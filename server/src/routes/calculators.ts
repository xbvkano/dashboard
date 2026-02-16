import { Router } from 'express'
import { 
  getTeamSize, 
  getPayRate, 
  getCarpetRate 
} from '../controllers/calculatorsController'

const router = Router()

// Calculator routes
router.get('/team-size', getTeamSize)
router.get('/pay-rate', getPayRate)
router.get('/carpet-rate', getCarpetRate)

export default router
