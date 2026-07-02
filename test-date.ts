import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const localProfile = await prisma.storeProfile.findUnique({ where: { id: 'local-store' }})
  console.log('local:', localProfile?.updatedAt, typeof localProfile?.updatedAt, localProfile?.updatedAt.getTime())
  console.log('local ISO:', localProfile?.updatedAt.toISOString())
}
main()
