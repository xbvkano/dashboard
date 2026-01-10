/**
 * Migration script to convert existing recurring appointments to RecurrenceFamily model
 * 
 * NOTE: This script requires the old fields (reoccurring, reocuringDate) to still exist
 * in the database. If you've already removed these fields, this script cannot be run.
 * 
 * For new databases, this script is not needed.
 * 
 * Usage: npx ts-node server/src/scripts/migrateRecurringData.ts
 */

import { PrismaClient } from '@prisma/client'
import { parseLegacyFrequency, ruleToJson, calculateNextAppointmentDate } from '../utils/recurrenceUtils'

const prisma = new PrismaClient()

async function migrateRecurringData() {
  console.log('Starting migration of recurring appointments...')
  console.log('NOTE: This script requires old recurring fields to exist in the database.')

  try {
    // Try to find appointments with REOCCURRING status
    // Note: We can't query by reoccurring field if it doesn't exist
    const recurringAppointments = await prisma.appointment.findMany({
      where: {
        status: 'REOCCURRING',
      },
      include: {
        client: true,
        employees: true,
      },
      orderBy: { date: 'asc' },
    })

    console.log(`Found ${recurringAppointments.length} recurring appointments to migrate`)

    // Group by lineage
    const lineageGroups = new Map<string, typeof recurringAppointments>()
    for (const appt of recurringAppointments) {
      if (appt.lineage && appt.lineage !== 'single') {
        if (!lineageGroups.has(appt.lineage)) {
          lineageGroups.set(appt.lineage, [])
        }
        lineageGroups.get(appt.lineage)!.push(appt)
      }
    }

    console.log(`Found ${lineageGroups.size} unique recurrence lineages`)

    // For each lineage, create a RecurrenceFamily
    for (const [lineage, appts] of lineageGroups.entries()) {
      if (appts.length === 0) continue

      // Get the first appointment to determine the rule
      const firstAppt = appts[0]
      
      // Try to determine frequency from date differences between appointments
      // Calculate interval from first two appointments
      let rule
      if (appts.length >= 2) {
        const daysDiff = Math.floor(
          (new Date(appts[1].date).getTime() - new Date(firstAppt.date).getTime()) /
          (1000 * 60 * 60 * 24)
        )
        
        if (daysDiff === 7) {
          rule = { type: 'weekly' as const, interval: 1 }
        } else if (daysDiff === 14) {
          rule = { type: 'biweekly' as const, interval: 2 }
        } else if (daysDiff === 21) {
          rule = { type: 'every3weeks' as const, interval: 3 }
        } else if (daysDiff >= 28 && daysDiff <= 31) {
          rule = { type: 'monthly' as const }
        } else {
          // Default to weekly
          rule = { type: 'weekly' as const, interval: 1 }
        }
      } else {
        // Default to weekly
        rule = { type: 'weekly' as const, interval: 1 }
      }

      // Find the last confirmed appointment (or the most recent one)
      const sortedAppts = [...appts].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      const lastAppt = sortedAppts[0]
      
      // Calculate next appointment date from the last appointment
      const nextDate = calculateNextAppointmentDate(rule, new Date(lastAppt.date))

      // Create the RecurrenceFamily
      const family = await prisma.recurrenceFamily.create({
        data: {
          status: 'active',
          recurrenceRule: ruleToJson(rule),
          nextAppointmentDate: nextDate,
        },
      })

      console.log(`Created RecurrenceFamily ${family.id} for lineage ${lineage}`)

      // Update all appointments in this lineage to reference the family
      // Convert status from REOCCURRING to APPOINTED for confirmed ones
      // Keep any that are already CANCEL or DELETED as is
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      for (const appt of appts) {
        const apptDate = new Date(appt.date)
        apptDate.setHours(0, 0, 0, 0)

        let newStatus = appt.status
        if (appt.status === 'REOCCURRING') {
          // If the appointment date is in the future and matches nextDate, make it unconfirmed
          // Otherwise, make it confirmed
          if (apptDate >= today) {
            const nextDateOnly = new Date(nextDate)
            nextDateOnly.setHours(0, 0, 0, 0)
            if (apptDate.getTime() === nextDateOnly.getTime()) {
              newStatus = 'RECURRING_UNCONFIRMED'
            } else {
              newStatus = 'APPOINTED'
            }
          } else {
            newStatus = 'APPOINTED'
          }
        }

        await prisma.appointment.update({
          where: { id: appt.id },
          data: {
            familyId: family.id,
            status: newStatus as any,
          },
        })
      }

      // Create unconfirmed instance if nextDate is in the future
      const nextDateOnly = new Date(nextDate)
      nextDateOnly.setHours(0, 0, 0, 0)
      if (nextDateOnly >= today) {
        // Check if we already have an unconfirmed appointment for this date
        const existing = await prisma.appointment.findFirst({
          where: {
            familyId: family.id,
            status: 'RECURRING_UNCONFIRMED',
            date: {
              gte: new Date(nextDateOnly),
              lt: new Date(nextDateOnly.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        })

        if (!existing) {
          await prisma.appointment.create({
            data: {
              clientId: firstAppt.clientId,
              adminId: firstAppt.adminId,
              date: nextDate,
              time: firstAppt.time,
              type: firstAppt.type,
              address: firstAppt.address,
              cityStateZip: firstAppt.cityStateZip,
              size: firstAppt.size,
              hours: firstAppt.hours,
              price: firstAppt.price,
              paid: false,
              tip: 0,
              noTeam: firstAppt.noTeam,
              carpetRooms: firstAppt.carpetRooms,
              carpetPrice: firstAppt.carpetPrice,
              carpetEmployees: [],
              paymentMethod: 'CASH',
              notes: firstAppt.notes,
              status: 'RECURRING_UNCONFIRMED',
              lineage: 'single',
              familyId: family.id,
            },
          })
          console.log(`Created unconfirmed appointment for family ${family.id}`)
        }
      }
    }

    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
migrateRecurringData()
  .then(() => {
    console.log('Migration script finished')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration script error:', error)
    process.exit(1)
  })
