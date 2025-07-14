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
      { name: 'John Doe', number: '555-1111', address: '123 Main St' },
      { name: 'Jane Smith', number: '555-2222', address: '456 Oak Ave' }
    ]
  })

  await prisma.employee.createMany({
    data: [
      { name: 'Emp One', number: '555-3333', address: '789 Pine Rd' },
      { name: 'Emp Two', number: '555-4444', address: '321 Cedar Ln' }
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
