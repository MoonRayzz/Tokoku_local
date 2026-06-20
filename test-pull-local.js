const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const prisma = new PrismaClient();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  const { data: atts } = await supabase.from('Attendance').select('*').gte('date', yesterdayStr);
  
  if (atts) {
    for (const att of atts) {
      await prisma.attendance.upsert({
        where: { id: att.id },
        update: { checkIn: att.checkIn ? new Date(att.checkIn) : null, checkOut: att.checkOut ? new Date(att.checkOut) : null, shiftId: att.shiftId, notes: att.notes, hoursWorked: att.hoursWorked, wageUsed: att.wageUsed, totalWage: att.totalWage, isSolo: att.isSolo },
        create: { id: att.id, employeeId: att.employeeId, shiftId: att.shiftId, date: new Date(att.date), checkIn: att.checkIn ? new Date(att.checkIn) : null, checkOut: att.checkOut ? new Date(att.checkOut) : null, notes: att.notes, hoursWorked: att.hoursWorked, wageUsed: att.wageUsed, totalWage: att.totalWage, isSolo: att.isSolo, createdAt: new Date(att.createdAt) }
      });
    }
  }
  
  const local = await prisma.attendance.findMany();
  console.log('Local Attendances:', local);
}
test().catch(console.error).finally(() => prisma.$disconnect());
