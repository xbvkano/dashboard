import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { ruleToJson, calculateNextAppointmentDate } from '../src/utils/recurrenceUtils'
import { calculateAppointmentHours } from '../src/utils/appointmentUtils'

const prisma = new PrismaClient()

// Generate userName from phone number (remove +1 and formatting)
function generateUserName(phoneNumber: string): string {
  // Remove all non-digit characters, then remove leading 1 if present
  const digits = phoneNumber.replace(/\D/g, '')
  return digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits
}

async function main() {
  // Clear existing data to avoid duplicates when reseeding
  // Delete in order to respect foreign key constraints
  await prisma.payrollItem.deleteMany()
  await prisma.employeePayment.deleteMany()
  await prisma.schedule.deleteMany() // Delete schedules before employees
  await prisma.appointment.deleteMany()
  await prisma.recurrenceFamily.deleteMany() // Delete recurrence families before clients
  await prisma.employeeTemplate.deleteMany()
  await prisma.appointmentTemplate.deleteMany()
  await prisma.employee.deleteMany()
  await prisma.client.deleteMany()
  await prisma.user.deleteMany()
  
  // Reset auto-increment sequences (PostgreSQL)
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "User_id_seq" RESTART WITH 1`)
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Employee_id_seq" RESTART WITH 1`)
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Client_id_seq" RESTART WITH 1`)
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "RecurrenceFamily_id_seq" RESTART WITH 1`)

  // Seed base users/clients/employees
  const admin = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      name: 'Alice',
      role: 'ADMIN',
      type: 'Google', // Admin users use Google auth
    },
  })

  // Create AI Admin user with ID 9
  await prisma.user.create({
    data: {
      id: 9,
      email: 'ai@system.com',
      name: 'AI Admin',
      role: 'ADMIN',
      type: 'Google', // AI Admin uses Google auth
    },
  })
  
  // Reset sequence to start after ID 9
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "User_id_seq" RESTART WITH 10`)

  const john = await prisma.client.create({
    data: { name: 'John Doe', number: '5551111111', from: 'Yelp' },
  })
  const jane = await prisma.client.create({
    data: { name: 'Jane Smith', number: '5552222222', from: 'Call' },
  })
  const marcos = await prisma.client.create({
    data: { name: 'Marcos Kano', number: '7255774523', from: 'Test' },
  })

  // Create users for employees with password authentication
  const empOnePassword = await bcrypt.hash('password123', 10)
  const empOneUserName = generateUserName('5553333333')
  const empOneUser = await prisma.user.create({
    data: {
      name: 'Emp One',
      userName: empOneUserName,
      password: empOnePassword,
      type: 'password',
      role: 'EMPLOYEE',
    },
  })

  const empTwoPassword = await bcrypt.hash('password123', 10)
  const empTwoUserName = generateUserName('5554444444')
  const empTwoUser = await prisma.user.create({
    data: {
      name: 'Emp Two',
      userName: empTwoUserName,
      password: empTwoPassword,
      type: 'password',
      role: 'EMPLOYEE',
    },
  })

  const empThreePassword = await bcrypt.hash('password123', 10)
  const empThreeUserName = generateUserName('5555555555')
  const empThreeUser = await prisma.user.create({
    data: {
      name: 'Emp Three',
      userName: empThreeUserName,
      password: empThreePassword,
      type: 'password',
      role: 'EMPLOYEE',
    },
  })

  const empFourPassword = await bcrypt.hash('password123', 10)
  const empFourUserName = generateUserName('17255774523')
  const empFourUser = await prisma.user.create({
    data: {
      name: 'Marcos Kano',
      userName: empFourUserName,
      password: empFourPassword,
      type: 'password',
      role: 'EMPLOYEE',
    },
  })

  const empOne = await prisma.employee.create({
    data: { 
      name: 'Emp One', 
      number: '5553333333', 
      userId: empOneUser.id,
    },
  })
  const empTwo = await prisma.employee.create({
    data: { 
      name: 'Emp Two', 
      number: '5554444444', 
      userId: empTwoUser.id,
    },
  })
  const empThree = await prisma.employee.create({
    data: { 
      name: 'Emp Three', 
      number: '5555555555', 
      userId: empThreeUser.id,
    },
  })
  const empFour = await prisma.employee.create({
    data: { 
      name: 'Marcos Kano', 
      number: '+17255774523', 
      userId: empFourUser.id,
    },
  })

  const temp1 = await prisma.appointmentTemplate.create({
    data: {
      templateName: 'John Standard',
      type: 'STANDARD',
      size: '1500-2000',
      address: '123 Main St',
      price: 120,
      clientId: john.id,
    },
  })
  const temp2 = await prisma.appointmentTemplate.create({
    data: {
      templateName: 'Jane Deep',
      type: 'DEEP',
      size: '2000-2500',
      address: '456 Oak Ave',
      price: 200,
      clientId: jane.id,
    },
  })
  const temp3 = await prisma.appointmentTemplate.create({
    data: {
      templateName: 'Marcos Standard',
      type: 'STANDARD',
      size: '1500-2000',
      address: '789 Test St',
      price: 150,
      clientId: marcos.id,
      instructions: 'Use side door. Pet in backyard. Leave invoice in mailbox.',
    },
  })

  const today = new Date()
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)

  // Past appointment not recurring with multiple employees
  const pastSingle = await prisma.appointment.create({
    data: {
      adminId: admin.id,
      clientId: john.id,
      date: addDays(today, -7),
      time: '09:00',
      type: temp1.type,
      address: temp1.address,
      size: temp1.size,
      hours: 4,
      price: temp1.price,
      paymentMethod: 'CASH',
      lineage: 'single-a',
      notes: 'Past single appointment',
      employees: {
        connect: [{ id: empOne.id }, { id: empTwo.id }],
      },
    },
    include: { employees: true },
  })

  // Past recurring appointment (now just a regular appointment for seed data)
  const pastRecurring = await prisma.appointment.create({
    data: {
      adminId: admin.id,
      clientId: john.id,
      date: addDays(today, -3),
      time: '11:00',
      type: temp1.type,
      address: temp1.address,
      size: temp1.size,
      hours: 4,
      price: temp1.price,
      paymentMethod: 'CASH',
      lineage: 'weekly-1',
      status: 'APPOINTED',
      notes: 'Past recurring appointment',
      employees: { connect: [{ id: empTwo.id }] },
    },
    include: { employees: true },
  })

  // Future recurring appointment (now just a regular appointment for seed data)
  const futureRecurring = await prisma.appointment.create({
    data: {
      adminId: admin.id,
      clientId: john.id,
      date: addDays(today, 4),
      time: '11:00',
      type: temp1.type,
      address: temp1.address,
      size: temp1.size,
      hours: 4,
      price: temp1.price,
      paymentMethod: 'CASH',
      lineage: 'weekly-1',
      status: 'APPOINTED',
      notes: 'Future recurring appointment',
      employees: { connect: [{ id: empTwo.id }] },
    },
    include: { employees: true },
  })

  // Future single appointment with different employees
  const futureSingle = await prisma.appointment.create({
    data: {
      adminId: admin.id,
      clientId: jane.id,
      date: addDays(today, 15),
      time: '10:00',
      type: temp2.type,
      address: temp2.address,
      size: temp2.size,
      hours: 5,
      price: temp2.price,
      paymentMethod: 'VENMO',
      lineage: 'single-b',
      notes: 'Future single appointment',
      employees: { connect: [{ id: empOne.id }, { id: empThree.id }] },
    },
    include: { employees: true },
  })

  // Helper to create payroll items for an appointment
  const createPayroll = async (appt: typeof pastSingle) => {
    return Promise.all(
      appt.employees.map((e) =>
        prisma.payrollItem.create({
          data: { appointmentId: appt.id, employeeId: e.id },
        })
      )
    )
  }

  const a1Items = await createPayroll(pastSingle)
  await createPayroll(pastRecurring)
  await createPayroll(futureRecurring)
  await createPayroll(futureSingle)

  // Marcos Kano (empFour) test appointments: past (should NOT show on Upcoming Jobs) and upcoming (within 14 days)
  const marcosPast1 = await prisma.appointment.create({
    data: {
      adminId: admin.id,
      clientId: marcos.id,
      date: addDays(today, -5),
      time: '09:00',
      type: temp3.type,
      address: temp3.address,
      size: temp3.size,
      hours: 4,
      price: temp3.price,
      paymentMethod: 'CASH',
      lineage: 'marcos-past-am',
      templateId: temp3.id,
      employees: { connect: [{ id: empFour.id }] },
    },
    include: { employees: true },
  })
  const marcosPast2 = await prisma.appointment.create({
    data: {
      adminId: admin.id,
      clientId: marcos.id,
      date: addDays(today, -2),
      time: '14:00',
      type: temp3.type,
      address: '456 Past Ave',
      size: temp3.size,
      hours: 4,
      price: temp3.price,
      paymentMethod: 'CASH',
      lineage: 'marcos-past-pm',
      templateId: temp3.id,
      employees: { connect: [{ id: empFour.id }] },
    },
    include: { employees: true },
  })
  // Upcoming: day 2 AM only
  const marcosUp1 = await prisma.appointment.create({
    data: {
      adminId: admin.id,
      clientId: marcos.id,
      date: addDays(today, 2),
      time: '09:00',
      type: temp3.type,
      address: temp3.address,
      size: temp3.size,
      hours: 4,
      price: temp3.price,
      paymentMethod: 'CASH',
      lineage: 'marcos-up-am',
      templateId: temp3.id,
      employees: { connect: [{ id: empFour.id }] },
    },
    include: { employees: true },
  })
  // Upcoming: day 5 PM only
  const marcosUp2 = await prisma.appointment.create({
    data: {
      adminId: admin.id,
      clientId: marcos.id,
      date: addDays(today, 5),
      time: '15:00',
      type: temp3.type,
      address: '100 PM Only St',
      size: temp3.size,
      hours: 4,
      price: temp3.price,
      paymentMethod: 'CASH',
      lineage: 'marcos-up-pm',
      templateId: temp3.id,
      employees: { connect: [{ id: empFour.id }] },
    },
    include: { employees: true },
  })
  // Upcoming: day 7 same day AM and PM (two appointments)
  const marcosUp3Am = await prisma.appointment.create({
    data: {
      adminId: admin.id,
      clientId: marcos.id,
      date: addDays(today, 7),
      time: '10:00',
      type: temp3.type,
      address: temp3.address,
      size: temp3.size,
      hours: 4,
      price: temp3.price,
      paymentMethod: 'CASH',
      lineage: 'marcos-up-same-am',
      templateId: temp3.id,
      employees: { connect: [{ id: empFour.id }] },
    },
    include: { employees: true },
  })
  const marcosUp3Pm = await prisma.appointment.create({
    data: {
      adminId: admin.id,
      clientId: jane.id,
      date: addDays(today, 7),
      time: '14:00',
      type: temp2.type,
      address: temp2.address,
      size: temp2.size,
      hours: 5,
      price: temp2.price,
      paymentMethod: 'VENMO',
      lineage: 'marcos-up-same-pm',
      templateId: temp2.id,
      employees: { connect: [{ id: empFour.id }] },
    },
    include: { employees: true },
  })
  // Upcoming: day 10 AM only
  const marcosUp4 = await prisma.appointment.create({
    data: {
      adminId: admin.id,
      clientId: marcos.id,
      date: addDays(today, 10),
      time: '08:00',
      type: temp3.type,
      address: '200 Early AM Rd',
      size: temp3.size,
      hours: 4,
      price: temp3.price,
      paymentMethod: 'CASH',
      lineage: 'marcos-up-am2',
      templateId: temp3.id,
      employees: { connect: [{ id: empFour.id }] },
    },
    include: { employees: true },
  })
  // Upcoming: day 13 PM only
  const marcosUp5 = await prisma.appointment.create({
    data: {
      adminId: admin.id,
      clientId: jane.id,
      date: addDays(today, 13),
      time: '16:00',
      type: temp2.type,
      address: temp2.address,
      size: temp2.size,
      hours: 5,
      price: temp2.price,
      paymentMethod: 'CASH',
      lineage: 'marcos-up-pm2',
      templateId: temp2.id,
      employees: { connect: [{ id: empFour.id }] },
    },
    include: { employees: true },
  })
  // Beyond 14 days: should NOT show on Upcoming Jobs
  const marcosBeyond1 = await prisma.appointment.create({
    data: {
      adminId: admin.id,
      clientId: marcos.id,
      date: addDays(today, 16),
      time: '10:00',
      type: temp3.type,
      address: temp3.address,
      size: temp3.size,
      hours: 4,
      price: temp3.price,
      paymentMethod: 'CASH',
      lineage: 'marcos-beyond-1',
      templateId: temp3.id,
      employees: { connect: [{ id: empFour.id }] },
    },
    include: { employees: true },
  })
  const marcosBeyond2 = await prisma.appointment.create({
    data: {
      adminId: admin.id,
      clientId: jane.id,
      date: addDays(today, 20),
      time: '14:00',
      type: temp2.type,
      address: temp2.address,
      size: temp2.size,
      hours: 5,
      price: temp2.price,
      paymentMethod: 'CASH',
      lineage: 'marcos-beyond-2',
      templateId: temp2.id,
      employees: { connect: [{ id: empFour.id }] },
    },
    include: { employees: true },
  })
  await createPayroll(marcosPast1)
  await createPayroll(marcosPast2)
  await createPayroll(marcosUp1)
  await createPayroll(marcosUp2)
  await createPayroll(marcosUp3Am)
  await createPayroll(marcosUp3Pm)
  await createPayroll(marcosUp4)
  await createPayroll(marcosUp5)
  await createPayroll(marcosBeyond1)
  await createPayroll(marcosBeyond2)

  // Mark one payroll item for each of the first two employees as paid
  const payment1 = await prisma.employeePayment.create({
    data: { employeeId: empOne.id, amount: 100 },
  })
  const payment2 = await prisma.employeePayment.create({
    data: { employeeId: empTwo.id, amount: 90 },
  })

  await prisma.payrollItem.update({
    where: { id: a1Items.find((it) => it.employeeId === empOne.id)!.id },
    data: { paid: true, paymentId: payment1.id },
  })
  await prisma.payrollItem.update({
    where: { id: a1Items.find((it) => it.employeeId === empTwo.id)!.id },
    data: { paid: true, paymentId: payment2.id },
  })

  // Create schedules for all employees with past and future entries
  // Reuse the 'today' variable that was already declared above
  
  // Helper function to format schedule entry: YYYY-MM-DD-T-S
  const formatScheduleEntry = (date: Date, type: 'M' | 'A', status: 'F' | 'B' = 'F'): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}-${type}-${status}`
  }

  // Create schedules for each employee with a mix of available/unavailable for current week (for Team Options modal testing)
  // Slot A = AM (before 2pm), M = PM (2pm+). Status F = free/available.
  const employees = [empOne, empTwo, empThree, empFour]
  const employeeIndex = (emp: { id: number }) => employees.findIndex((e) => e.id === emp.id)

  for (const employee of employees) {
    const pastSchedule: string[] = []
    const futureSchedule: string[] = []
    const idx = employeeIndex(employee)

    // Add past schedule entries (5 days ago to yesterday)
    for (let i = 5; i >= 1; i--) {
      const pastDate = new Date(today)
      pastDate.setDate(pastDate.getDate() - i)
      if (i % 2 === 0) pastSchedule.push(formatScheduleEntry(pastDate, 'M', 'F'))
      if (i % 3 === 0) pastSchedule.push(formatScheduleEntry(pastDate, 'A', 'F'))
    }

    // Current week = today and next 6 days (7 days). Different pattern per employee for testing.
    for (let i = 0; i < 7; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      if (idx === 0) {
        // Emp 1: Available both AM and PM every day this week
        futureSchedule.push(formatScheduleEntry(d, 'A', 'F'))
        futureSchedule.push(formatScheduleEntry(d, 'M', 'F'))
      } else if (idx === 1) {
        // Emp 2: Available AM and PM on even-indexed days (e.g. Mon, Wed, Fri)
        if (i % 2 === 0) {
          futureSchedule.push(formatScheduleEntry(d, 'A', 'F'))
          futureSchedule.push(formatScheduleEntry(d, 'M', 'F'))
        }
      } else if (idx === 2) {
        // Emp 3: Available only AM (before 2pm) this week
        futureSchedule.push(formatScheduleEntry(d, 'A', 'F'))
      } else {
        // Emp 4: No availability this week (all non-available for Team Options testing)
        // no entries for days 0..6
      }
    }

    // Rest of future (day 7 to 14): all employees get some availability so seed stays usable
    for (let i = 7; i <= 14; i++) {
      const futureDate = new Date(today)
      futureDate.setDate(futureDate.getDate() + i)
      if (i % 2 === 0) futureSchedule.push(formatScheduleEntry(futureDate, 'M', 'F'))
      if (i % 3 === 0) futureSchedule.push(formatScheduleEntry(futureDate, 'A', 'F'))
    }

    const updateDate = new Date(today)
    updateDate.setDate(updateDate.getDate() - 3)

    await prisma.schedule.create({
      data: {
        employeeId: employee.id,
        pastSchedule,
        futureSchedule,
        employeeUpdate: updateDate
      }
    })
  }

  // Create recurrence families with relevant dates

  // Active recurrence family 1: Weekly, past confirmed + future unconfirmed
  const family1FirstDate = addDays(today, -14) // 2 weeks ago
  const family1NextDate = addDays(today, 7) // 1 week from now
  const family1 = await prisma.recurrenceFamily.create({
    data: {
      status: 'active',
      recurrenceRule: ruleToJson({ type: 'weekly', interval: 1 }),
      nextAppointmentDate: family1NextDate,
    },
  })
  
  // Past confirmed appointment
  await prisma.appointment.create({
    data: {
      clientId: john.id,
      adminId: admin.id,
      date: family1FirstDate,
      time: '10:00',
      type: temp1.type,
      address: temp1.address,
      size: temp1.size,
      hours: calculateAppointmentHours(temp1.size, temp1.type),
      price: temp1.price,
      paymentMethod: 'CASH',
      status: 'APPOINTED',
      lineage: 'single',
      familyId: family1.id,
      employees: { connect: [{ id: empOne.id }] },
    },
  })

  // Future unconfirmed appointment
  await prisma.appointment.create({
    data: {
      clientId: john.id,
      adminId: admin.id,
      date: family1NextDate,
      time: '10:00',
      type: temp1.type,
      address: temp1.address,
      size: temp1.size,
      hours: calculateAppointmentHours(temp1.size, temp1.type),
      price: temp1.price,
      paymentMethod: 'CASH',
      status: 'RECURRING_UNCONFIRMED',
      lineage: 'single',
      familyId: family1.id,
    },
  })

  // Active recurrence family 2: Biweekly, future confirmed + future unconfirmed
  const family2FirstDate = addDays(today, 3) // 3 days from now
  const family2NextDate = addDays(today, 17) // 17 days from now (2 weeks later)
  const family2 = await prisma.recurrenceFamily.create({
    data: {
      status: 'active',
      recurrenceRule: ruleToJson({ type: 'biweekly', interval: 2 }),
      nextAppointmentDate: family2NextDate,
    },
  })

  await prisma.appointment.create({
    data: {
      clientId: jane.id,
      adminId: admin.id,
      date: family2FirstDate,
      time: '14:00',
      type: temp2.type,
      address: temp2.address,
      size: temp2.size,
      hours: calculateAppointmentHours(temp2.size, temp2.type),
      price: temp2.price,
      paymentMethod: 'VENMO',
      status: 'APPOINTED',
      lineage: 'single',
      familyId: family2.id,
      employees: { connect: [{ id: empTwo.id }, { id: empThree.id }] },
    },
  })

  await prisma.appointment.create({
    data: {
      clientId: jane.id,
      adminId: admin.id,
      date: family2NextDate,
      time: '14:00',
      type: temp2.type,
      address: temp2.address,
      size: temp2.size,
      hours: calculateAppointmentHours(temp2.size, temp2.type),
      price: temp2.price,
      paymentMethod: 'CASH',
      status: 'RECURRING_UNCONFIRMED',
      lineage: 'single',
      familyId: family2.id,
    },
  })

  // Stopped recurrence family: Had a missed unconfirmed appointment
  const stoppedFamilyFirstDate = addDays(today, -21) // 3 weeks ago
  const stoppedFamilyMissedDate = addDays(today, -7) // 1 week ago (missed)
  const stoppedFamily = await prisma.recurrenceFamily.create({
    data: {
      status: 'stopped',
      recurrenceRule: ruleToJson({ type: 'weekly', interval: 1 }),
      nextAppointmentDate: stoppedFamilyMissedDate, // This was the missed date
    },
  })

  // Past confirmed
  await prisma.appointment.create({
    data: {
      clientId: john.id,
      adminId: admin.id,
      date: stoppedFamilyFirstDate,
      time: '11:00',
      type: temp1.type,
      address: temp1.address,
      size: temp1.size,
      hours: calculateAppointmentHours(temp1.size, temp1.type),
      price: temp1.price,
      paymentMethod: 'CASH',
      status: 'APPOINTED',
      lineage: 'single',
      familyId: stoppedFamily.id,
      employees: { connect: [{ id: empTwo.id }] },
    },
  })

  // Missed unconfirmed (this caused the family to stop)
  await prisma.appointment.create({
    data: {
      clientId: john.id,
      adminId: admin.id,
      date: stoppedFamilyMissedDate,
      time: '11:00',
      type: temp1.type,
      address: temp1.address,
      size: temp1.size,
      hours: calculateAppointmentHours(temp1.size, temp1.type),
      price: temp1.price,
      paymentMethod: 'CASH',
      status: 'RECURRING_UNCONFIRMED',
      lineage: 'single',
      familyId: stoppedFamily.id,
    },
  })

  // Active recurrence family 3: Monthly intervals (every 2 months)
  const family3FirstDate = addDays(today, -30) // 1 month ago
  const family3NextDate = addDays(today, 30) // 1 month from now
  const family3 = await prisma.recurrenceFamily.create({
    data: {
      status: 'active',
      recurrenceRule: ruleToJson({ type: 'customMonths', interval: 2 }),
      nextAppointmentDate: family3NextDate,
    },
  })

  await prisma.appointment.create({
    data: {
      clientId: jane.id,
      adminId: admin.id,
      date: family3FirstDate,
      time: '09:00',
      type: temp2.type,
      address: temp2.address,
      size: temp2.size,
      hours: calculateAppointmentHours(temp2.size, temp2.type),
      price: temp2.price,
      paymentMethod: 'CASH',
      status: 'APPOINTED',
      lineage: 'single',
      familyId: family3.id,
      employees: { connect: [{ id: empOne.id }] },
    },
  })

  await prisma.appointment.create({
    data: {
      clientId: jane.id,
      adminId: admin.id,
      date: family3NextDate,
      time: '09:00',
      type: temp2.type,
      address: temp2.address,
      size: temp2.size,
      hours: calculateAppointmentHours(temp2.size, temp2.type),
      price: temp2.price,
      paymentMethod: 'CASH',
      status: 'RECURRING_UNCONFIRMED',
      lineage: 'single',
      familyId: family3.id,
    },
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
