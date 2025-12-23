import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Move past dates from futureSchedule to pastSchedule for a given test date
export async function movePastSchedulesForDate(testDate?: Date): Promise<void> {
  const cutoffDate = testDate || new Date()
  cutoffDate.setHours(0, 0, 0, 0)
  
  try {
    // Get all schedules
    const schedules = await prisma.schedule.findMany({
      include: { employee: true }
    })

    for (const schedule of schedules) {
      const newFuture: string[] = []
      const newPast = [...schedule.pastSchedule]

      schedule.futureSchedule.forEach(entry => {
        const parts = entry.split('-')
        if (parts.length !== 5) {
          // Invalid format, skip
          return
        }

        const [year, month, day] = parts
        const entryDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        entryDate.setHours(0, 0, 0, 0)

        // Compare dates (entryDate should be moved if it's before the cutoff date)
        if (entryDate.getTime() < cutoffDate.getTime()) {
          // Move to past
          newPast.push(entry)
        } else {
          // Keep in future
          newFuture.push(entry)
        }
      })

      // Update if there were changes
      if (newFuture.length !== schedule.futureSchedule.length || newPast.length !== schedule.pastSchedule.length) {
        const movedCount = schedule.futureSchedule.length - newFuture.length
        await prisma.schedule.update({
          where: { id: schedule.id },
          data: {
            futureSchedule: newFuture,
            pastSchedule: newPast
          }
        })
        console.log(`Moved ${movedCount} entries from future to past for employee ${schedule.employeeId}`)
      }
    }
  } catch (error) {
    console.error('Error moving past schedules:', error)
    throw error
  }
}

// Setup cron job to run daily at midnight
export function setupScheduleCleanupJob(): void {
  // Run daily at 00:00 (midnight)
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily schedule cleanup job...')
    try {
      await movePastSchedulesForDate()
      console.log('Schedule cleanup job completed successfully')
    } catch (error) {
      console.error('Schedule cleanup job failed:', error)
    }
  })
  
  console.log('Schedule cleanup cron job scheduled to run daily at midnight')
}

