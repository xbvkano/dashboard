import { Router } from 'express'
import { requireCallCenterKey } from '../middleware/requireCallCenterKey'
import {
  callerContext,
  employeeByCode,
  onDuty,
} from '../controllers/callCenterController'

const router = Router()

router.use(requireCallCenterKey)

router.get('/caller-context', callerContext)
router.get('/employees/by-code/:code', employeeByCode)
router.get('/on-duty', onDuty)

export default router
