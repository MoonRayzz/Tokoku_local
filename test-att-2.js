const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  console.log("yesterdayStr is:", yesterdayStr);
  const { data, error } = await supabase.from('Attendance').select('*').gte('date', yesterdayStr);
  console.log("Result:", data?.length, error);
}
test();
