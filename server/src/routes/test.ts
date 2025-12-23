import { Router } from 'express'
import { testMovePastSchedules, testScheduleReminder } from '../controllers/testController'

const router = Router()

// Test routes (only enable in development)
router.post('/test/schedule/move-past', testMovePastSchedules)
router.post('/test/schedule/reminder/:employeeId', testScheduleReminder)

export default router

