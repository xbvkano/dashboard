import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.user.create({
    data: {
      email: 'alice@example.com',
      name: 'Alice'
    }
  })

  await prisma.client.createMany({
    data: [
      { name: 'John Doe', number: '5551111111' },
      { name: 'Jane Smith', number: '5552222222' }
    ]
  })

  await prisma.employee.createMany({
    data: [
      { name: 'Emp One', number: '5553333333', experienced: true },
      { name: 'Emp Two', number: '5554444444', experienced: false }
    ]
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
