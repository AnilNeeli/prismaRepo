import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL!
})


  async function main() {
  // CREATE
  const user = await prisma.user.create({
    data: {
      email: 'anil@test2.com',
      name: 'Anil',
      age: 28,
      balance: 1000.00,
    }
  })
  console.log('Created:', user.id)

  // FIND
  const found = await prisma.user.findUnique({
    where: { email: 'anil@test.com' }
  })
  console.log('Found:', found?.name)

  // UPDATE
  const updated = await prisma.user.update({
    where: { email: 'anil@test.com' },
    data: { balance: 1500.00 }
  })
  console.log('Updated balance:', updated.balance)
  console.log('updatedAt changed:', user.updatedAt !== updated.updatedAt)

  // DELETE
  await prisma.user.delete({
    where: { email: 'anil@test.com' }
  })
  console.log('Deleted')
}


main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())