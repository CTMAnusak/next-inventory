/**
 * 🧪 สคริปต์ทดสอบระบบ Snapshot เมื่อลบสาขา
 * 
 * จำลองเหตุการณ์:
 * 1. สร้างสาขา "CTW" 
 * 2. สร้างผู้ใช้และให้อยู่สาขา "CTW"
 * 3. ทำการเบิก-คืนอุปกรณ์
 * 4. เปลี่ยนสาขาผู้ใช้จาก "CTW" → "Central Wategate"
 * 5. ลบสาขา "Central Wategate"
 * 6. ตรวจสอบว่า snapshot ถูกต้องหรือไม่
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/models/User').default;
const Office = require('./src/models/Office').default;
const RequestLog = require('./src/models/RequestLog').default;
const ReturnLog = require('./src/models/ReturnLog').default;
const IssueLog = require('./src/models/IssueLog').default;
const InventoryItem = require('./src/models/InventoryItem').default;

// Import helpers
const { snapshotOfficeBeforeDelete } = require('./src/lib/office-snapshot-helpers');

// ตัวแปรเก็บข้อมูลการทดสอบ
let testData = {
  offices: {},
  users: {},
  logs: {}
};

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // ลบข้อมูลทดสอบ
    if (testData.users.testUser) {
      await User.deleteOne({ user_id: testData.users.testUser });
      console.log('  ✓ Deleted test user');
    }
    
    if (testData.offices.ctw) {
      await Office.deleteOne({ office_id: testData.offices.ctw });
      console.log('  ✓ Deleted CTW office');
    }
    
    if (testData.offices.centralWategate) {
      await Office.deleteOne({ office_id: testData.offices.centralWategate });
      console.log('  ✓ Deleted Central Wategate office');
    }
    
    // ลบ logs
    if (testData.logs.requestLog) {
      await RequestLog.deleteOne({ _id: testData.logs.requestLog });
      console.log('  ✓ Deleted request log');
    }
    
    if (testData.logs.returnLog) {
      await ReturnLog.deleteOne({ _id: testData.logs.returnLog });
      console.log('  ✓ Deleted return log');
    }
    
    if (testData.logs.issueLog) {
      await IssueLog.deleteOne({ _id: testData.logs.issueLog });
      console.log('  ✓ Deleted issue log');
    }
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  }
}

async function step1_CreateCTWOffice() {
  console.log('\n📍 Step 1: สร้างสาขา "CTW"');
  
  const officeId = 'TEST_CTW_' + Date.now();
  const office = new Office({
    office_id: officeId,
    name: 'CTW',
    isActive: true,
    isSystemOffice: false
  });
  
  await office.save();
  testData.offices.ctw = officeId;
  
  console.log(`  ✓ Created office: ${office.name} (${officeId})`);
  return officeId;
}

async function step2_CreateUser(officeId) {
  console.log('\n👤 Step 2: สร้างผู้ใช้และให้อยู่สาขา "CTW"');
  
  const userId = 'TEST_USER_' + Date.now();
  const user = new User({
    user_id: userId,
    firstName: 'วัฒน์นี',
    lastName: 'ใจดี',
    nickname: 'วัฒน์',
    email: 'test@example.com',
    phone: '0841234567',
    userType: 'individual',
    role: 'กรม',
    officeId: officeId,
    office: 'CTW',
    officeName: 'CTW',
    createdAt: new Date(),
    isActive: true
  });
  
  await user.save();
  testData.users.testUser = userId;
  
  console.log(`  ✓ Created user: ${user.firstName} ${user.lastName}`);
  console.log(`  ✓ User office: ${user.office} (officeId: ${user.officeId})`);
  return userId;
}

async function step3_CreateRequestAndReturnLogs(userId, officeId) {
  console.log('\n📦 Step 3: ทำการเบิก-คืนอุปกรณ์');
  
  // สร้าง RequestLog
  const requestLog = new RequestLog({
    userId: userId,
    requestType: 'request',
    status: 'approved',
    requesterFirstName: 'วัฒน์นี',
    requesterLastName: 'ใจดี',
    requesterNickname: 'วัฒน์',
    requesterDepartment: 'd1',
    requesterPhone: '0841234567',
    requesterOfficeId: officeId,
    requesterOffice: 'CTW',
    requesterOfficeName: 'CTW',
    items: [{
      itemId: 'TEST_ITEM_123',
      itemName: 'Mouse Logitech',
      quantity: 1,
      category: 'Mouse'
    }],
    createdAt: new Date()
  });
  
  await requestLog.save();
  testData.logs.requestLog = requestLog._id;
  
  console.log(`  ✓ Created RequestLog`);
  console.log(`    - User: ${requestLog.userId}`);
  console.log(`    - Office: ${requestLog.requesterOffice} (officeId: ${requestLog.requesterOfficeId})`);
  
  // สร้าง ReturnLog
  const returnLog = new ReturnLog({
    userId: userId,
    status: 'approved',
    returnerFirstName: 'วัฒน์นี',
    returnerLastName: 'ใจดี',
    returnerNickname: 'วัฒน์',
    returnerDepartment: 'd1',
    returnerPhone: '0841234567',
    returnerOfficeId: officeId,
    returnerOffice: 'CTW',
    returnerOfficeName: 'CTW',
    items: [{
      itemId: 'TEST_ITEM_123',
      itemName: 'Mouse Logitech',
      quantity: 1,
      category: 'Mouse',
      approvalStatus: 'approved'
    }],
    createdAt: new Date()
  });
  
  await returnLog.save();
  testData.logs.returnLog = returnLog._id;
  
  console.log(`  ✓ Created ReturnLog`);
  console.log(`    - User: ${returnLog.userId}`);
  console.log(`    - Office: ${returnLog.returnerOffice} (officeId: ${returnLog.returnerOfficeId})`);
  
  // สร้าง IssueLog
  const issueLog = new IssueLog({
    userId: userId,
    firstName: 'วัฒน์นี',
    lastName: 'ใจดี',
    nickname: 'วัฒน์',
    department: 'd1',
    phone: '0841234567',
    email: 'test@example.com',
    officeId: officeId,
    office: 'CTW',
    officeName: 'CTW',
    equipmentName: 'Mouse Logitech',
    problemDescription: 'ชำรุด',
    status: 'รอดำเนินการ',
    createdAt: new Date()
  });
  
  await issueLog.save();
  testData.logs.issueLog = issueLog._id;
  
  console.log(`  ✓ Created IssueLog`);
  console.log(`    - User: ${issueLog.userId}`);
  console.log(`    - Office: ${issueLog.office} (officeId: ${issueLog.officeId})`);
}

async function step4_ChangeUserOffice(userId) {
  console.log('\n🔄 Step 4: เปลี่ยนสาขาผู้ใช้จาก "CTW" → "Central Wategate"');
  
  // สร้างสาขาใหม่
  const newOfficeId = 'TEST_CENTRAL_WATEGATE_' + Date.now();
  const newOffice = new Office({
    office_id: newOfficeId,
    name: 'Central Wategate',
    isActive: true,
    isSystemOffice: false
  });
  
  await newOffice.save();
  testData.offices.centralWategate = newOfficeId;
  
  console.log(`  ✓ Created new office: ${newOffice.name} (${newOfficeId})`);
  
  // อัพเดตผู้ใช้
  const user = await User.findOne({ user_id: userId });
  user.officeId = newOfficeId;
  user.office = 'Central Wategate';
  user.officeName = 'Central Wategate';
  await user.save();
  
  console.log(`  ✓ Updated user office to: ${user.office}`);
  console.log(`  ✓ User officeId: ${user.officeId}`);
  
  // ตรวจสอบว่า RequestLog/ReturnLog ยังเป็นเดิม
  const requestLog = await RequestLog.findById(testData.logs.requestLog);
  const returnLog = await ReturnLog.findById(testData.logs.returnLog);
  const issueLog = await IssueLog.findById(testData.logs.issueLog);
  
  console.log(`  ℹ️  RequestLog.requesterOfficeId ยังเป็น: ${requestLog.requesterOfficeId} (CTW)`);
  console.log(`  ℹ️  ReturnLog.returnerOfficeId ยังเป็น: ${returnLog.returnerOfficeId} (CTW)`);
  console.log(`  ℹ️  IssueLog.officeId ยังเป็น: ${issueLog.officeId} (CTW)`);
  
  return newOfficeId;
}

async function step5_DeleteCentralWategateOffice(officeId, userId) {
  console.log('\n🗑️  Step 5: ลบสาขา "Central Wategate" พร้อม Snapshot');
  
  console.log('\n  📸 Before snapshot:');
  const requestLogBefore = await RequestLog.findById(testData.logs.requestLog);
  const returnLogBefore = await ReturnLog.findById(testData.logs.returnLog);
  const issueLogBefore = await IssueLog.findById(testData.logs.issueLog);
  const userBefore = await User.findOne({ user_id: userId });
  
  console.log(`    RequestLog.requesterOffice: "${requestLogBefore.requesterOffice}"`);
  console.log(`    RequestLog.requesterOfficeId: "${requestLogBefore.requesterOfficeId}"`);
  console.log(`    ReturnLog.returnerOffice: "${returnLogBefore.returnerOffice}"`);
  console.log(`    ReturnLog.returnerOfficeId: "${returnLogBefore.returnerOfficeId}"`);
  console.log(`    IssueLog.office: "${issueLogBefore.office}"`);
  console.log(`    IssueLog.officeId: "${issueLogBefore.officeId}"`);
  console.log(`    User.office: "${userBefore.office}"`);
  console.log(`    User.officeId: "${userBefore.officeId}"`);
  
  // Snapshot
  console.log('\n  🔄 Running snapshotOfficeBeforeDelete...');
  const snapshotResult = await snapshotOfficeBeforeDelete(officeId);
  
  console.log(`  ✓ Snapshot completed:`, snapshotResult);
  
  console.log('\n  📸 After snapshot:');
  const requestLogAfter = await RequestLog.findById(testData.logs.requestLog);
  const returnLogAfter = await ReturnLog.findById(testData.logs.returnLog);
  const issueLogAfter = await IssueLog.findById(testData.logs.issueLog);
  const userAfter = await User.findOne({ user_id: userId });
  
  console.log(`    RequestLog.requesterOffice: "${requestLogAfter.requesterOffice}"`);
  console.log(`    RequestLog.requesterOfficeId: "${requestLogAfter.requesterOfficeId}"`);
  console.log(`    ReturnLog.returnerOffice: "${returnLogAfter.returnerOffice}"`);
  console.log(`    ReturnLog.returnerOfficeId: "${returnLogAfter.returnerOfficeId}"`);
  console.log(`    IssueLog.office: "${issueLogAfter.office}"`);
  console.log(`    IssueLog.officeId: "${issueLogAfter.officeId}"`);
  console.log(`    User.office: "${userAfter.office}"`);
  console.log(`    User.officeId: "${userAfter.officeId}"`);
  
  // อัพเดต officeId เป็น UNSPECIFIED_OFFICE
  console.log('\n  🔄 Updating officeId to UNSPECIFIED_OFFICE...');
  await User.updateMany({ officeId: officeId }, { $set: { officeId: 'UNSPECIFIED_OFFICE' } });
  
  // Soft delete office
  const office = await Office.findOne({ office_id: officeId });
  office.isActive = false;
  office.deletedAt = new Date();
  await office.save();
  
  console.log(`  ✓ Office soft deleted`);
  
  console.log('\n  📸 Final state:');
  const requestLogFinal = await RequestLog.findById(testData.logs.requestLog);
  const returnLogFinal = await ReturnLog.findById(testData.logs.returnLog);
  const issueLogFinal = await IssueLog.findById(testData.logs.issueLog);
  const userFinal = await User.findOne({ user_id: userId });
  
  console.log(`    RequestLog.requesterOffice: "${requestLogFinal.requesterOffice}"`);
  console.log(`    RequestLog.requesterOfficeId: "${requestLogFinal.requesterOfficeId}"`);
  console.log(`    ReturnLog.returnerOffice: "${returnLogFinal.returnerOffice}"`);
  console.log(`    ReturnLog.returnerOfficeId: "${returnLogFinal.returnerOfficeId}"`);
  console.log(`    IssueLog.office: "${issueLogFinal.office}"`);
  console.log(`    IssueLog.officeId: "${issueLogFinal.officeId}"`);
  console.log(`    User.office: "${userFinal.office}"`);
  console.log(`    User.officeId: "${userFinal.officeId}"`);
}

async function step6_VerifyResults() {
  console.log('\n✅ Step 6: ตรวจสอบผลลัพธ์');
  
  const requestLog = await RequestLog.findById(testData.logs.requestLog);
  const returnLog = await ReturnLog.findById(testData.logs.returnLog);
  const issueLog = await IssueLog.findById(testData.logs.issueLog);
  const user = await User.findOne({ user_id: testData.users.testUser });
  
  console.log('\n  🔍 ตรวจสอบความถูกต้อง:');
  
  // ตรวจสอบว่า snapshot เป็น "Central Wategate"
  const requestOfficeCorrect = requestLog.requesterOffice === 'Central Wategate';
  const returnOfficeCorrect = returnLog.returnerOffice === 'Central Wategate';
  const issueOfficeCorrect = issueLog.office === 'Central Wategate';
  const userOfficeCorrect = user.office === 'Central Wategate';
  
  console.log(`    ${requestOfficeCorrect ? '✅' : '❌'} RequestLog.requesterOffice = "${requestLog.requesterOffice}" (ควรเป็น "Central Wategate")`);
  console.log(`    ${returnOfficeCorrect ? '✅' : '❌'} ReturnLog.returnerOffice = "${returnLog.returnerOffice}" (ควรเป็น "Central Wategate")`);
  console.log(`    ${issueOfficeCorrect ? '✅' : '❌'} IssueLog.office = "${issueLog.office}" (ควรเป็น "Central Wategate")`);
  console.log(`    ${userOfficeCorrect ? '✅' : '❌'} User.office = "${user.office}" (ควรเป็น "Central Wategate")`);
  
  // ตรวจสอบว่า officeId เป็น UNSPECIFIED_OFFICE
  const userOfficeIdCorrect = user.officeId === 'UNSPECIFIED_OFFICE';
  console.log(`    ${userOfficeIdCorrect ? '✅' : '❌'} User.officeId = "${user.officeId}" (ควรเป็น "UNSPECIFIED_OFFICE")`);
  
  // ตรวจสอบว่า requesterOfficeId/returnerOfficeId ยังเป็นเดิม (CTW)
  const requestOfficeIdCorrect = requestLog.requesterOfficeId.startsWith('TEST_CTW_');
  const returnOfficeIdCorrect = returnLog.returnerOfficeId.startsWith('TEST_CTW_');
  const issueOfficeIdCorrect = issueLog.officeId.startsWith('TEST_CTW_');
  
  console.log(`    ${requestOfficeIdCorrect ? '✅' : '❌'} RequestLog.requesterOfficeId ยังเป็น CTW (ไม่เปลี่ยน)`);
  console.log(`    ${returnOfficeIdCorrect ? '✅' : '❌'} ReturnLog.returnerOfficeId ยังเป็น CTW (ไม่เปลี่ยน)`);
  console.log(`    ${issueOfficeIdCorrect ? '✅' : '❌'} IssueLog.officeId ยังเป็น CTW (ไม่เปลี่ยน)`);
  
  const allCorrect = requestOfficeCorrect && returnOfficeCorrect && issueOfficeCorrect && 
                     userOfficeCorrect && userOfficeIdCorrect && 
                     requestOfficeIdCorrect && returnOfficeIdCorrect && issueOfficeIdCorrect;
  
  if (allCorrect) {
    console.log('\n  🎉 ผลการทดสอบ: ผ่านทุกข้อ!');
    console.log('  ✅ ระบบ snapshot ทำงานถูกต้อง');
    console.log('  ✅ ประวัติแสดงสาขาล่าสุด "Central Wategate" แม้จะเบิก-คืนตอนอยู่สาขา "CTW"');
  } else {
    console.log('\n  ❌ ผลการทดสอบ: พบข้อผิดพลาด!');
    console.log('  ❌ กรุณาตรวจสอบระบบ snapshot');
  }
  
  return allCorrect;
}

async function runTest() {
  try {
    await connectDB();
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  🧪 ทดสอบระบบ Snapshot เมื่อลบสาขา                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
    // Step 1: สร้างสาขา "CTW"
    const ctwOfficeId = await step1_CreateCTWOffice();
    
    // Step 2: สร้างผู้ใช้และให้อยู่สาขา "CTW"
    const userId = await step2_CreateUser(ctwOfficeId);
    
    // Step 3: ทำการเบิก-คืนอุปกรณ์
    await step3_CreateRequestAndReturnLogs(userId, ctwOfficeId);
    
    // Step 4: เปลี่ยนสาขาผู้ใช้จาก "CTW" → "Central Wategate"
    const centralWategateOfficeId = await step4_ChangeUserOffice(userId);
    
    // Step 5: ลบสาขา "Central Wategate"
    await step5_DeleteCentralWategateOffice(centralWategateOfficeId, userId);
    
    // Step 6: ตรวจสอบผลลัพธ์
    const success = await step6_VerifyResults();
    
    // Cleanup
    await cleanup();
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║  ${success ? '✅ การทดสอบสำเร็จ!' : '❌ การทดสอบล้มเหลว!'}                                     ║`);
    console.log('╚════════════════════════════════════════════════════════════╝');
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    await cleanup();
    process.exit(1);
  }
}

// รันการทดสอบ
runTest();

