import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Clear existing data to avoid duplicates when reseeding
  await prisma.payrollItem.deleteMany()
  await prisma.employeePayment.deleteMany()
  await prisma.appointment.deleteMany()
  await prisma.employeeTemplate.deleteMany()
  await prisma.appointmentTemplate.deleteMany()
  await prisma.employee.deleteMany()
  await prisma.client.deleteMany()
  await prisma.user.deleteMany()

  // Seed base users/clients/employees
  const admin = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      name: 'Alice',
      role: 'ADMIN',
    },
  })

  const john = await prisma.client.create({
    data: { name: 'John Doe', number: '5551111111' },
  })
  const jane = await prisma.client.create({
    data: { name: 'Jane Smith', number: '5552222222' },
  })

  const empOne = await prisma.employee.create({
    data: { name: 'Emp One', number: '5553333333', experienced: true },
  })
  const empTwo = await prisma.employee.create({
    data: { name: 'Emp Two', number: '5554444444', experienced: false },
  })
  const empThree = await prisma.employee.create({
    data: { name: 'Emp Three', number: '5555555555', experienced: true },
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
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
