import { Router } from 'express'
import {
  getWeekView,
  listDutyAssignees,
  listRecurrences,
  replaceRecurrences,
} from '../controllers/onDutyController'

const router = Router()

router.get('/on-duty/assignees', listDutyAssignees)
router.get('/on-duty/recurrences', listRecurrences)
router.put('/on-duty/recurrences', replaceRecurrences)
router.get('/on-duty/week', getWeekView)

export default router
