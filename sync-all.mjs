import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany();
  for (const p of products) {
    await prisma.syncQueue.create({
      data: {
        tableName: 'Product',
        recordId: p.id,
        operation: 'INSERT',
        payload: JSON.stringify(p),
        status: 'PENDING'
      }
    });
  }

  const members = await prisma.member.findMany();
  for (const m of members) {
    await prisma.syncQueue.create({
      data: {
        tableName: 'Member',
        recordId: m.id,
        operation: 'INSERT',
        payload: JSON.stringify(m),
        status: 'PENDING'
      }
    });
  }

  // Also reset Transaction SyncQueue to PENDING so it retries
  await prisma.syncQueue.updateMany({
    where: { tableName: 'Transaction' },
    data: { status: 'PENDING' }
  });

  console.log(`Queued ${products.length} products and ${members.length} members for sync. Reset transactions.`);
}

main().finally(() => prisma.$disconnect());
