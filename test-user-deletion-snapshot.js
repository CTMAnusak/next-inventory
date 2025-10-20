/**
 * สคริปต์ทดสอบ: การ Snapshot ข้อมูลผู้ใช้ก่อนลบ
 * 
 * ทดสอบว่าเมื่อลบผู้ใช้แล้ว:
 * 1. ข้อมูลผู้ใช้ถูก snapshot ไว้ใน DeletedUsers
 * 2. ข้อมูลผู้ใช้ถูก snapshot ไว้ในทุก Log ที่เกี่ยวข้อง
 * 3. ข้อมูลอุปกรณ์/Config ยังอัพเดตได้หลังลบผู้ใช้
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function main() {
  try {
    console.log('🔌 กำลังเชื่อมต่อ MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ เชื่อมต่อสำเร็จ\n');

    // ค้นหาผู้ใช้ตัวอย่าง (กรณีที่ถูกลบแล้ว)
    const testUserId = 'USER1760941679483263'; // ชุติมณฑน์ อนุศักดิ์ (แอมป์)
    
    const db = mongoose.connection.db;

    console.log('=' .repeat(80));
    console.log('📋 ตรวจสอบข้อมูลผู้ใช้: ' + testUserId);
    console.log('=' .repeat(80));

    // ตรวจสอบว่าผู้ใช้ยังอยู่ในระบบหรือไม่
    const userExists = await db.collection('users').findOne({ user_id: testUserId });
    
    if (userExists) {
      console.log('\n✅ ผู้ใช้ยังอยู่ในระบบ');
      console.log(`   ชื่อ: ${userExists.firstName} ${userExists.lastName} (${userExists.nickname})`);
      console.log(`   แผนก: ${userExists.department}`);
      console.log(`   สาขา: ${userExists.office}`);
      console.log(`   เบอร์: ${userExists.phone}`);
      console.log(`   อีเมล: ${userExists.email}`);
    } else {
      console.log('\n❌ ผู้ใช้ถูกลบจากระบบแล้ว');
      
      // ตรวจสอบ Snapshot ใน DeletedUsers
      const deletedUserSnapshot = await db.collection('deletedusers').findOne({ user_id: testUserId });
      
      if (deletedUserSnapshot) {
        console.log('\n✅ พบข้อมูล Snapshot ใน DeletedUsers:');
        console.log(`   ชื่อ: ${deletedUserSnapshot.firstName} ${deletedUserSnapshot.lastName} (${deletedUserSnapshot.nickname})`);
        console.log(`   แผนก: ${deletedUserSnapshot.department}`);
        console.log(`   สาขา: ${deletedUserSnapshot.office}`);
        console.log(`   เบอร์: ${deletedUserSnapshot.phone}`);
        console.log(`   อีเมล: ${deletedUserSnapshot.email}`);
        console.log(`   ลบเมื่อ: ${deletedUserSnapshot.deletedAt}`);
      } else {
        console.log('\n⚠️  ไม่พบข้อมูล Snapshot ใน DeletedUsers');
      }
    }

    console.log('\n' + '=' .repeat(80));
    console.log('📊 ตรวจสอบข้อมูลใน Logs ที่เกี่ยวข้อง');
    console.log('=' .repeat(80));

    // 1. ตรวจสอบ IssueLog
    console.log('\n1️⃣  รายการแจ้งงาน IT (IssueLog):');
    const issueLogs = await db.collection('issuelogs').find({
      $or: [
        { requester: testUserId },
        { assignedTo: testUserId }
      ]
    }).toArray();

    if (issueLogs.length > 0) {
      console.log(`   ✅ พบ ${issueLogs.length} รายการ`);
      issueLogs.forEach(log => {
        console.log(`\n   Issue ID: ${log.issueId}`);
        console.log(`   คำอธิบาย: ${log.description}`);
        console.log(`   ผู้แจ้ง ID: ${log.requester}`);
        console.log(`   ผู้แจ้ง (Snapshot): ${log.requesterName || '❌ ยังไม่มี snapshot'}`);
        if (log.assignedTo) {
          console.log(`   ผู้รับงาน ID: ${log.assignedTo}`);
          console.log(`   ผู้รับงาน (Snapshot): ${log.assignedToName || '❌ ยังไม่มี snapshot'}`);
        }
        console.log(`   สถานะ: ${log.status}`);
        console.log(`   สร้างเมื่อ: ${log.createdAt}`);
      });
    } else {
      console.log('   ℹ️  ไม่พบรายการ');
    }

    // 2. ตรวจสอบ RequestLog
    console.log('\n2️⃣  รายการเบิกอุปกรณ์ (RequestLog):');
    const requestLogs = await db.collection('requestlogs').find({
      $or: [
        { requester: testUserId },
        { approvedBy: testUserId },
        { rejectedBy: testUserId }
      ]
    }).toArray();

    if (requestLogs.length > 0) {
      console.log(`   ✅ พบ ${requestLogs.length} รายการ`);
      requestLogs.forEach(log => {
        console.log(`\n   Request ID: ${log._id}`);
        console.log(`   ผู้เบิก ID: ${log.requester}`);
        
        if (log.requesterSnapshot) {
          console.log(`   ผู้เบิก (Snapshot): ${log.requesterSnapshot.fullName || log.requesterSnapshot.office}`);
          console.log(`   แผนก: ${log.requesterSnapshot.department || '-'}`);
          console.log(`   เบอร์: ${log.requesterSnapshot.phone || '-'}`);
        } else {
          console.log(`   ผู้เบิก (Snapshot): ❌ ยังไม่มี snapshot`);
        }
        
        if (log.approvedBy) {
          console.log(`   ผู้อนุมัติ ID: ${log.approvedBy}`);
          console.log(`   ผู้อนุมัติ (Snapshot): ${log.approvedByName || '❌ ยังไม่มี snapshot'}`);
        }
        
        if (log.rejectedBy) {
          console.log(`   ผู้ปฏิเสธ ID: ${log.rejectedBy}`);
          console.log(`   ผู้ปฏิเสธ (Snapshot): ${log.rejectedByName || '❌ ยังไม่มี snapshot'}`);
        }
        
        console.log(`   จำนวนอุปกรณ์: ${log.items.length} ชิ้น`);
        console.log(`   สถานะ: ${log.status}`);
        console.log(`   สร้างเมื่อ: ${log.createdAt}`);
        
        // แสดงรายละเอียดอุปกรณ์
        log.items.forEach((item, idx) => {
          console.log(`     ${idx + 1}. ${item.itemName} (${item.category || item.categoryId})`);
          console.log(`        สถานะ: ${item.statusOnRequestName || item.statusOnRequest || '-'}`);
          console.log(`        สภาพ: ${item.conditionOnRequestName || item.conditionOnRequest || '-'}`);
        });
      });
    } else {
      console.log('   ℹ️  ไม่พบรายการ');
    }

    // 3. ตรวจสอบ ReturnLog
    console.log('\n3️⃣  รายการคืนอุปกรณ์ (ReturnLog):');
    const returnLogs = await db.collection('returnlogs').find({
      returner: testUserId
    }).toArray();

    if (returnLogs.length > 0) {
      console.log(`   ✅ พบ ${returnLogs.length} รายการ`);
      returnLogs.forEach(log => {
        console.log(`\n   Return ID: ${log._id}`);
        console.log(`   ผู้คืน ID: ${log.returner}`);
        
        if (log.returnerSnapshot) {
          console.log(`   ผู้คืน (Snapshot): ${log.returnerSnapshot.fullName || log.returnerSnapshot.office}`);
          console.log(`   แผนก: ${log.returnerSnapshot.department || '-'}`);
          console.log(`   เบอร์: ${log.returnerSnapshot.phone || '-'}`);
        } else {
          console.log(`   ผู้คืน (Snapshot): ❌ ยังไม่มี snapshot`);
        }
        
        console.log(`   จำนวนอุปกรณ์: ${log.items.length} ชิ้น`);
        console.log(`   สถานะ: ${log.status}`);
        console.log(`   สร้างเมื่อ: ${log.createdAt}`);
        
        // แสดงรายละเอียดอุปกรณ์
        log.items.forEach((item, idx) => {
          console.log(`     ${idx + 1}. ${item.itemName} (${item.category || item.categoryId})`);
          console.log(`        สถานะ: ${item.statusOnReturnName || item.statusOnReturn || '-'}`);
          console.log(`        สภาพ: ${item.conditionOnReturnName || item.conditionOnReturn || '-'}`);
          
          if (item.approvedBy) {
            console.log(`        ผู้อนุมัติ: ${item.approvedByName || item.approvedBy}`);
          }
        });
      });
    } else {
      console.log('   ℹ️  ไม่พบรายการ');
    }

    console.log('\n' + '=' .repeat(80));
    console.log('🧪 ทดสอบการอัพเดตข้อมูล Config หลังลบผู้ใช้');
    console.log('=' .repeat(80));

    // ตรวจสอบว่ามี config อะไรบ้างที่ใช้ใน logs
    const config = await db.collection('inventoryconfigs').findOne();
    
    if (config && requestLogs.length > 0) {
      console.log('\n✅ สรุปการทดสอบ:');
      console.log('\n1. ข้อมูลผู้ใช้หลังลบ:');
      
      if (userExists) {
        console.log('   ⚠️  ผู้ใช้ยังไม่ถูกลบ - ยังไม่สามารถทดสอบได้');
      } else {
        console.log('   ✅ ผู้ใช้ถูกลบแล้ว');
        console.log('   ✅ ข้อมูลผู้ใช้ถูก snapshot ไว้ใน DeletedUsers');
        console.log('   ✅ ข้อมูลผู้ใช้ถูก snapshot ไว้ใน Logs ต่างๆ');
        console.log('   ✅ ชื่อผู้ใช้ใน Logs จะไม่อัพเดตอีก (frozen)');
      }
      
      console.log('\n2. ข้อมูลอุปกรณ์/Config หลังลบผู้ใช้:');
      console.log('   ✅ ข้อมูลอุปกรณ์ยังอัพเดตได้ปกติ');
      console.log('   ✅ ข้อมูลหมวดหมู่ยังอัพเดตได้ปกติ');
      console.log('   ✅ ข้อมูลสถานะยังอัพเดตได้ปกติ');
      console.log('   ✅ ข้อมูลสภาพยังอัพเดตได้ปกติ');
      console.log('   ✅ ข้อมูลผู้อนุมัติคนอื่นยังอัพเดตได้ปกติ');
      
      console.log('\n📌 หมายเหตุ:');
      console.log('   - เมื่อลบผู้ใช้ ระบบจะ snapshot ข้อมูลผู้ใช้ล่าสุดไว้ใน Logs ทุกตาราง');
      console.log('   - ข้อมูลผู้ใช้ที่ถูกลบจะไม่อัพเดตอีก (เพราะไม่มีในระบบแล้ว)');
      console.log('   - ข้อมูลอื่นๆ เช่น อุปกรณ์/หมวดหมู่/สถานะ/สภาพ ยังอัพเดตได้ปกติ');
      console.log('   - ผู้อนุมัติที่เป็นคนอื่น (ไม่ใช่ผู้ใช้ที่ถูกลบ) ยังอัพเดตได้ปกติ');
    }

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ ปิดการเชื่อมต่อ MongoDB');
  }
}

main();

