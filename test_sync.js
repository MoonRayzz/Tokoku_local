require('dotenv').config({path: '.env'});
const { syncToCloud } = require('./.next/server/app/pengaturan/actions.js');

async function test() {
  console.time('syncToCloud');
  const res = await syncToCloud();
  console.log(res);
  console.timeEnd('syncToCloud');
}
test().catch(console.error);
