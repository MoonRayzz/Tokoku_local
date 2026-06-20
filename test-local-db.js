const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  const atts = await prisma.attendance.findMany();
  console.log("Local Attendances:", atts.length);
  const emps = await prisma.employee.findMany();
  console.log("Local Employees:", emps.length);
  const shifts = await prisma.shift.findMany();
  console.log("Local Shifts:", shifts.length);
}
test().catch(console.error).finally(() => prisma.$disconnect());
