import { Router } from 'express'
import {
  testMovePastSchedules,
  testScheduleReminder,
  testScheduleCleanup,
  testScheduleReminderJob,
  testRecurringSync,
  testAppointmentReminder,
  testUnconfirmedCheck,
  testNoonEmployeeReminder,
  testBackfillAppointmentDateUtc,
} from '../controllers/testController'
import { getPushoverTestSamples, sendPushoverTest } from '../controllers/pushoverTestController'
import {
  getCallCenterTestStatus,
  probeCallCenterApi,
  proxyCallCenterVoice,
} from '../controllers/callCenterTestController'

const router = Router()

// Test routes (only enable in development)
router.post('/test/schedule/move-past', testMovePastSchedules)
router.post('/test/schedule/reminder/:employeeId', testScheduleReminder)
router.post('/test/jobs/schedule-cleanup', testScheduleCleanup)
router.post('/test/jobs/schedule-reminder', testScheduleReminderJob)
router.post('/test/jobs/recurring-sync', testRecurringSync)
router.post('/test/jobs/appointment-reminder', testAppointmentReminder)
router.post('/test/jobs/unconfirmed-check', testUnconfirmedCheck)
router.post('/test/jobs/noon-employee-reminder', testNoonEmployeeReminder)
router.post('/test/jobs/backfill-appointment-date-utc', testBackfillAppointmentDateUtc)
router.get('/test/pushover/samples', getPushoverTestSamples)
router.post('/test/pushover/send', sendPushoverTest)
router.get('/test/call-center/status', getCallCenterTestStatus)
router.post('/test/call-center/probe', probeCallCenterApi)
router.post('/test/call-center/voice', proxyCallCenterVoice)

export default router

