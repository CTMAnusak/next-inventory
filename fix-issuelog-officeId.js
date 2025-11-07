/**
 * 🔧 สคริปต์แก้ไข officeId ใน IssueLog
 * 
 * ปัญหา: officeId ใน IssueLog บันทึกเป็นชื่อสาขา (เช่น "CTP") แทนที่จะเป็น office ID
 * 
 * วิธีแก้: 
 * 1. ค้นหา IssueLog ทั้งหมดที่ officeId ไม่ตรงกับรูปแบบ office ID
 * 2. ใช้ requesterId ไปหา User และเอา officeId ที่ถูกต้องมา
 * 3. อัพเดต officeId และ officeName ให้ถูกต้อง
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const IssueLog = require('./src/models/IssueLog').default;
const User = require('./src/models/User').default;
const Office = require('./src/models/Office').default;

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function fixIssueLogOfficeIds() {
  try {
    console.log('\n🔍 Fetching all IssueLogs...');
    
    // หา IssueLog ทั้งหมด
    const issueLogs = await IssueLog.find({});
    console.log(`Found ${issueLogs.length} IssueLogs`);
    
    // สร้าง Map สำหรับ office ID to name
    const offices = await Office.find({ isActive: true });
    const officeIdToName = new Map();
    offices.forEach(office => {
      officeIdToName.set(office.office_id, office.name);
    });
    
    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const issueLog of issueLogs) {
      try {
        // ตรวจสอบว่า officeId เป็นชื่อสาขาหรือไม่ (ไม่ใช่ office ID ที่ขึ้นต้นด้วย OFFICE_)
        const currentOfficeId = issueLog.officeId;
        
        // ถ้า officeId เป็น UNSPECIFIED_OFFICE หรือขึ้นต้นด้วย OFFICE_ แสดงว่าถูกต้องแล้ว
        if (!currentOfficeId || 
            currentOfficeId === 'UNSPECIFIED_OFFICE' || 
            currentOfficeId.startsWith('OFFICE_') ||
            currentOfficeId.startsWith('TEST_')) {
          skippedCount++;
          continue;
        }
        
        // officeId เป็นชื่อสาขา → ต้องแก้ไข
        console.log(`\n🔧 Fixing IssueLog ${issueLog.issueId}:`);
        console.log(`   Current officeId: "${currentOfficeId}" (ชื่อสาขา)`);
        
        // หา User จาก requesterId
        const user = await User.findOne({ user_id: issueLog.requesterId });
        
        if (!user) {
          console.log(`   ⚠️  User not found (requesterId: ${issueLog.requesterId})`);
          console.log(`   → Skipping (keep current data)`);
          skippedCount++;
          continue;
        }
        
        // อัพเดต officeId และ officeName
        const newOfficeId = user.officeId;
        const newOfficeName = user.officeName || user.office || officeIdToName.get(newOfficeId) || currentOfficeId;
        
        issueLog.officeId = newOfficeId;
        issueLog.officeName = newOfficeName;
        
        // ถ้ายังไม่มี office field ให้ใส่เพิ่ม
        if (!issueLog.office) {
          issueLog.office = newOfficeName;
        }
        
        await issueLog.save();
        
        console.log(`   ✅ Fixed!`);
        console.log(`   New officeId: "${newOfficeId}"`);
        console.log(`   New officeName: "${newOfficeName}"`);
        
        fixedCount++;
        
      } catch (error) {
        console.error(`   ❌ Error fixing IssueLog ${issueLog.issueId}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  📊 Summary                                                ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Total IssueLogs:     ${issueLogs.length.toString().padEnd(37)} ║`);
    console.log(`║  Fixed:               ${fixedCount.toString().padEnd(37)} ║`);
    console.log(`║  Skipped:             ${skippedCount.toString().padEnd(37)} ║`);
    console.log(`║  Errors:              ${errorCount.toString().padEnd(37)} ║`);
    console.log('╚════════════════════════════════════════════════════════════╝');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function run() {
  await connectDB();
  await fixIssueLogOfficeIds();
  await mongoose.disconnect();
  console.log('\n✅ Disconnected from MongoDB');
  process.exit(0);
}

run();

