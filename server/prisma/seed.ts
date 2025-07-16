import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.user.create({
    data: {
      email: 'alice@example.com',
      name: 'Alice'
    }
  })

  const john = await prisma.client.create({
    data: { name: 'John Doe', number: '5551111111' }
  })
  const jane = await prisma.client.create({
    data: { name: 'Jane Smith', number: '5552222222' }
  })

  const empOne = await prisma.employee.create({
    data: { name: 'Emp One', number: '5553333333', experienced: true }
  })
  const empTwo = await prisma.employee.create({
    data: { name: 'Emp Two', number: '5554444444', experienced: false }
  })

  const temp1 = await prisma.appointmentTemplate.create({
    data: {
      templateName: 'John Standard',
      type: 'STANDARD',
      size: '1500-2000',
      address: '123 Main St',
      price: 120,
      clientId: john.id
    }
  })
  const temp2 = await prisma.appointmentTemplate.create({
    data: {
      templateName: 'Jane Deep',
      type: 'DEEP',
      size: '1500-2000',
      address: '456 Oak Ave',
      price: 200,
      clientId: jane.id
    }
  })

  await prisma.appointment.create({
    data: {
      clientId: john.id,
      date: new Date(),
      time: '10:00',
      type: temp1.type,
      address: temp1.address,
      size: temp1.size,
      hours: 4,
      price: temp1.price,
      paymentMethod: 'CASH',
      lineage: 'single',
      notes: 'Seed appointment',
      employees: { connect: { id: empOne.id } }
    }
  })

  await prisma.appointment.create({
    data: {
      clientId: john.id,
      date: new Date(),
      time: '11:00',
      type: temp1.type,
      address: temp1.address,
      size: temp1.size,
      hours: 4,
      price: temp1.price,
      paymentMethod: 'CASH',
      lineage: 'single',
      notes: 'Seed overlap',
      employees: { connect: { id: empTwo.id } }
    }
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
