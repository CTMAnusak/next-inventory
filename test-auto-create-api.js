/**
 * สคริปต์ทดสอบ Auto-Create Snapshot API
 * ใช้เพื่อตรวจสอบว่า API endpoint /api/admin/inventory-snapshot/auto-create ทำงานได้จริงหรือไม่
 */

const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function testAutoCreateAPI() {
  try {
    const API_URL = process.env.API_URL || 'http://localhost:3000';
    const SECRET_KEY = process.env.SNAPSHOT_SECRET_KEY || process.env.VERCEL_SNAPSHOT_SECRET_KEY || 'default-secret-key-change-in-production';

    console.log('🔌 กำลังทดสอบ Auto-Create Snapshot API...\n');
    console.log(`   - API URL: ${API_URL}`);
    console.log(`   - Secret Key: ${SECRET_KEY.substring(0, 10)}...\n`);

    // ทดสอบ GET (ตรวจสอบสถานะ)
    console.log('📊 ทดสอบ GET (ตรวจสอบสถานะ):');
    try {
      const getResponse = await fetch(`${API_URL}/api/admin/inventory-snapshot/auto-create?secret=${SECRET_KEY}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const getData = await getResponse.json();
      console.log(`   - Status: ${getResponse.status}`);
      console.log(`   - Response:`, JSON.stringify(getData, null, 2));
    } catch (error) {
      console.error(`   - ❌ Error: ${error.message}`);
    }

    console.log('\n');

    // ทดสอบ POST (สร้าง snapshot)
    console.log('📝 ทดสอบ POST (สร้าง snapshot):');
    try {
      const postResponse = await fetch(`${API_URL}/api/admin/inventory-snapshot/auto-create?secret=${SECRET_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const postData = await postResponse.json();
      console.log(`   - Status: ${postResponse.status}`);
      console.log(`   - Response:`, JSON.stringify(postData, null, 2));

      if (postResponse.ok && postData.success) {
        console.log('\n✅ สร้าง Snapshot สำเร็จ!');
        console.log(`   - ปี: ${postData.snapshot?.year}`);
        console.log(`   - เดือน: ${postData.snapshot?.month}`);
        console.log(`   - totalInventoryItems: ${postData.snapshot?.totalInventoryItems}`);
        console.log(`   - totalInventoryCount: ${postData.snapshot?.totalInventoryCount}`);
        console.log(`   - lowStockItems: ${postData.snapshot?.lowStockItems}`);
      } else {
        console.log('\n⚠️  สร้าง Snapshot ไม่สำเร็จ');
        console.log(`   - Error: ${postData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`   - ❌ Error: ${error.message}`);
      console.error(`   - Stack: ${error.stack}`);
    }

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
    process.exit(1);
  }
}

// ตรวจสอบว่ามี server ทำงานอยู่หรือไม่
async function checkServer() {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  
  try {
    console.log('🔍 ตรวจสอบว่า server ทำงานอยู่หรือไม่...');
    const response = await fetch(`${API_URL}/api/health`, { method: 'GET' });
    console.log(`   - Server Status: ${response.ok ? '✅ ทำงาน' : '❌ ไม่ทำงาน'}\n`);
  } catch (error) {
    console.log(`   - ⚠️  ไม่สามารถเชื่อมต่อ server ได้ (${error.message})`);
    console.log(`   - 💡 ตรวจสอบว่า server ทำงานอยู่ที่ ${API_URL} หรือไม่\n`);
  }
}

async function main() {
  await checkServer();
  await testAutoCreateAPI();
}

main();

