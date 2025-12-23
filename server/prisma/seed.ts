import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

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
  await prisma.employeeTemplate.deleteMany()
  await prisma.appointmentTemplate.deleteMany()
  await prisma.employee.deleteMany()
  await prisma.client.deleteMany()
  await prisma.user.deleteMany()
  
  // Reset auto-increment sequences (PostgreSQL)
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "User_id_seq" RESTART WITH 1`)
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Employee_id_seq" RESTART WITH 1`)
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Client_id_seq" RESTART WITH 1`)

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
      name: 'Emp Four',
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
      experienced: true,
      userId: empOneUser.id,
    },
  })
  const empTwo = await prisma.employee.create({
    data: { 
      name: 'Emp Two', 
      number: '5554444444', 
      experienced: false,
      userId: empTwoUser.id,
    },
  })
  const empThree = await prisma.employee.create({
    data: { 
      name: 'Emp Three', 
      number: '5555555555', 
      experienced: true,
      userId: empThreeUser.id,
    },
  })
  const empFour = await prisma.employee.create({
    data: { 
      name: 'Emp Four', 
      number: '+17255774523', 
      experienced: true,
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

  // Past recurring appointment
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
      status: 'REOCCURRING',
      reoccurring: true,
      notes: 'Past recurring appointment',
      employees: { connect: [{ id: empTwo.id }] },
    },
    include: { employees: true },
  })

  // Future recurring appointment
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
      status: 'REOCCURRING',
      reoccurring: true,
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

  // Create schedules for each employee
  const employees = [empOne, empTwo, empThree, empFour]
  
  for (const employee of employees) {
    const pastSchedule: string[] = []
    const futureSchedule: string[] = []
    
    // Add past schedule entries (5 days ago to yesterday)
    for (let i = 5; i >= 1; i--) {
      const pastDate = new Date(today)
      pastDate.setDate(pastDate.getDate() - i)
      
      // Add some morning and afternoon shifts randomly
      if (i % 2 === 0) {
        pastSchedule.push(formatScheduleEntry(pastDate, 'M', 'F'))
      }
      if (i % 3 === 0) {
        pastSchedule.push(formatScheduleEntry(pastDate, 'A', 'F'))
      }
    }
    
    // Add future schedule entries (tomorrow to 14 days ahead)
    for (let i = 1; i <= 14; i++) {
      const futureDate = new Date(today)
      futureDate.setDate(futureDate.getDate() + i)
      
      // Add some morning and afternoon shifts
      if (i % 2 === 0) {
        futureSchedule.push(formatScheduleEntry(futureDate, 'M', 'F'))
      }
      if (i % 3 === 0) {
        futureSchedule.push(formatScheduleEntry(futureDate, 'A', 'F'))
      }
    }
    
    // Create schedule with employeeUpdate set to 3 days ago (to test reminder system)
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
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
