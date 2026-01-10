import cron from 'node-cron'
import { syncRecurringAppointments } from '../controllers/recurringController'

// Setup cron job to run daily at midnight
export function setupRecurringSyncJob(): void {
  // Run daily at 00:00 (midnight)
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily recurring appointments sync job...')
    try {
      await syncRecurringAppointments()
      console.log('Recurring appointments sync job completed successfully')
    } catch (error) {
      console.error('Recurring appointments sync job failed:', error)
    }
  })
  
  console.log('Recurring appointments sync cron job scheduled to run daily at midnight')
}
