const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const prisma = new PrismaClient();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data: updatedEmployees, error: employeeError } = await supabase.from('Employee').select('*');
  console.log('Supabase Employees:', updatedEmployees?.length, employeeError);

  const { data: att, error: attError } = await supabase.from('Attendance').select('*');
  console.log('Supabase Attendances:', att?.length, attError);

  console.log('Local Employees:', await prisma.employee.count());
}
test().catch(console.error).finally(() => prisma.$disconnect());
