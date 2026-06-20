const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const products = await prisma.product.findMany();
  for (const product of products) {
    await prisma.syncQueue.create({
      data: {
        tableName: 'Product',
        recordId: product.id,
        operation: 'UPDATE',
        payload: JSON.stringify(product),
        status: 'PENDING'
      }
    });
    console.log(`Queued sync for product ${product.name}`);
  }
}
fix().catch(console.error).finally(() => prisma.$disconnect());
