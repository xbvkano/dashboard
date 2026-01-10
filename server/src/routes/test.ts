import { Router } from 'express'
import { 
  testMovePastSchedules, 
  testScheduleReminder,
  testScheduleCleanup,
  testScheduleReminderJob,
  testRecurringSync,
  testAppointmentReminder
} from '../controllers/testController'

const router = Router()

// Test routes (only enable in development)
router.post('/test/schedule/move-past', testMovePastSchedules)
router.post('/test/schedule/reminder/:employeeId', testScheduleReminder)
router.post('/test/jobs/schedule-cleanup', testScheduleCleanup)
router.post('/test/jobs/schedule-reminder', testScheduleReminderJob)
router.post('/test/jobs/recurring-sync', testRecurringSync)
router.post('/test/jobs/appointment-reminder', testAppointmentReminder)

export default router

