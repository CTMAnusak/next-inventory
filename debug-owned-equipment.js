/**
 * Debug Script: ตรวจสอบอุปกรณ์ที่ผู้ใช้เป็นเจ้าของ
 * 
 * วิธีการใช้:
 * node debug-owned-equipment.js <serialNumber>
 * 
 * ตัวอย่าง:
 * node debug-owned-equipment.js 21216
 */

const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

async function debugOwnedEquipment(serialNumber) {
  try {
    console.log('🔌 เชื่อมต่อ MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ เชื่อมต่อสำเร็จ\n');

    // ✅ หาอุปกรณ์ตาม Serial Number
    const InventoryItem = mongoose.connection.collection('inventoryitems');
    const item = await InventoryItem.findOne({ serialNumber: serialNumber });

    if (!item) {
      console.log(`❌ ไม่พบอุปกรณ์ที่มี Serial Number: ${serialNumber}`);
      return;
    }

    console.log('📦 ข้อมูลอุปกรณ์ (SN: ' + serialNumber + ')');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('ID:', item._id);
    console.log('ชื่ออุปกรณ์:', item.itemName);
    console.log('หมวดหมู่ ID:', item.categoryId);
    console.log('Serial Number:', item.serialNumber);
    console.log('สถานะ ID:', item.statusId);
    console.log('สภาพ ID:', item.conditionId);
    console.log('');
    console.log('🔍 currentOwnership:');
    console.log('   ownerType:', item.currentOwnership?.ownerType || 'ไม่มี');
    console.log('   userId:', item.currentOwnership?.userId || 'ไม่มี');
    console.log('   ownedSince:', item.currentOwnership?.ownedSince || 'ไม่มี');
    console.log('   assignedBy:', item.currentOwnership?.assignedBy || 'ไม่มี');
    console.log('');
    console.log('📋 sourceInfo:');
    console.log('   addedBy:', item.sourceInfo?.addedBy || 'ไม่มี');
    console.log('   addedByUserId:', item.sourceInfo?.addedByUserId || 'ไม่มี');
    console.log('   dateAdded:', item.sourceInfo?.dateAdded || 'ไม่มี');
    console.log('   initialOwnerType:', item.sourceInfo?.initialOwnerType || 'ไม่มี');
    console.log('   acquisitionMethod:', item.sourceInfo?.acquisitionMethod || 'ไม่มี');
    console.log('');
    console.log('🔄 transferInfo:');
    console.log('   transferredFrom:', item.transferInfo?.transferredFrom || 'ไม่มี');
    console.log('   transferDate:', item.transferInfo?.transferDate || 'ไม่มี');
    console.log('   approvedBy:', item.transferInfo?.approvedBy || 'ไม่มี');
    console.log('   requestId:', item.transferInfo?.requestId || 'ไม่มี');
    console.log('');
    console.log('👤 requesterInfo:');
    console.log('   firstName:', item.requesterInfo?.firstName || 'ไม่มี');
    console.log('   lastName:', item.requesterInfo?.lastName || 'ไม่มี');
    console.log('   nickname:', item.requesterInfo?.nickname || 'ไม่มี');
    console.log('   department:', item.requesterInfo?.department || 'ไม่มี');
    console.log('   phone:', item.requesterInfo?.phone || 'ไม่มี');
    console.log('   office:', item.requesterInfo?.office || 'ไม่มี');
    console.log('');
    console.log('🗑️ deletedAt:', item.deletedAt || 'ไม่มี (ไม่ถูกลบ)');
    console.log('═══════════════════════════════════════════════════════════\n');

    // ✅ ตรวจสอบว่าอุปกรณ์นี้ควรแสดงใน Dashboard หรือไม่
    console.log('📊 การวิเคราะห์:');
    console.log('═══════════════════════════════════════════════════════════');
    
    const ownerType = item.currentOwnership?.ownerType;
    const userId = item.currentOwnership?.userId;
    const deletedAt = item.deletedAt;
    const acquisitionMethod = item.sourceInfo?.acquisitionMethod;

    if (deletedAt) {
      console.log('❌ อุปกรณ์ถูกลบแล้ว → ไม่แสดงใน Dashboard');
    } else if (ownerType !== 'user_owned') {
      console.log(`❌ ownerType: "${ownerType}" (ไม่ใช่ "user_owned") → ไม่แสดงใน Dashboard`);
    } else if (!userId) {
      console.log('❌ ไม่มี userId → ไม่แสดงใน Dashboard');
    } else {
      console.log(`✅ ownerType: "${ownerType}" → ควรแสดงใน Dashboard`);
      console.log(`✅ userId: "${userId}"`);
      console.log(`✅ acquisitionMethod: "${acquisitionMethod || 'ไม่มี'}"`);
      console.log('');
      console.log('🔍 ตรวจสอบ source ที่จะแสดง:');
      if (acquisitionMethod === 'self_reported') {
        console.log('   → source: "user-owned" (แสดงปุ่มแก้ไข)');
      } else {
        console.log('   → source: "request" (ไม่แสดงปุ่มแก้ไข)');
      }
    }

    // ✅ หาข้อมูลผู้ใช้
    console.log('\n👤 ข้อมูลผู้ใช้:');
    console.log('═══════════════════════════════════════════════════════════');
    
    if (userId) {
      const User = mongoose.connection.collection('users');
      const user = await User.findOne({ _id: new mongoose.Types.ObjectId(userId) });
      
      if (user) {
        console.log('ID:', user._id);
        console.log('Email:', user.email);
        console.log('ชื่อ-นามสกุล:', `${user.firstName || ''} ${user.lastName || ''}`);
        console.log('ชื่อเล่น:', user.nickname || 'ไม่มี');
        console.log('แผนก:', user.department || 'ไม่มี');
        console.log('สาขา:', user.office || 'ไม่มี');
        console.log('เบอร์โทร:', user.phone || 'ไม่มี');
        console.log('ประเภทผู้ใช้:', user.userType || 'ไม่มี');
      } else {
        console.log('❌ ไม่พบผู้ใช้ในระบบ (userId: ' + userId + ')');
      }
    } else {
      console.log('❌ ไม่มี userId');
    }

    // ✅ หา RequestLog ที่เกี่ยวข้อง
    if (item.transferInfo?.requestId) {
      console.log('\n📋 ข้อมูล RequestLog:');
      console.log('═══════════════════════════════════════════════════════════');
      
      const RequestLog = mongoose.connection.collection('requestlogs');
      const requestLog = await RequestLog.findOne({ _id: new mongoose.Types.ObjectId(item.transferInfo.requestId) });
      
      if (requestLog) {
        console.log('ID:', requestLog._id);
        console.log('สถานะ:', requestLog.status);
        console.log('userId:', requestLog.userId);
        console.log('deliveryLocation:', requestLog.deliveryLocation || 'ไม่มี');
        console.log('วันที่สร้าง:', requestLog.createdAt);
        console.log('วันที่อนุมัติ:', requestLog.approvedAt || 'ไม่มี');
        
        // ตรวจสอบ items ใน requestLog
        console.log('\n📦 รายการอุปกรณ์ใน RequestLog:');
        requestLog.items?.forEach((reqItem, idx) => {
          console.log(`   ${idx + 1}. ${reqItem.itemName || 'ไม่มีชื่อ'}`);
          console.log(`      assignedItemIds: ${reqItem.assignedItemIds ? `[${reqItem.assignedItemIds.join(', ')}]` : 'ไม่มี'}`);
          console.log(`      assignedQuantity: ${reqItem.assignedQuantity || 0}`);
          
          // เช็คว่า itemId ของเราอยู่ใน assignedItemIds หรือไม่
          if (reqItem.assignedItemIds?.includes(item._id.toString())) {
            console.log(`      ✅ พบ itemId (${item._id}) ใน assignedItemIds`);
          }
        });
      } else {
        console.log('❌ ไม่พบ RequestLog (requestId: ' + item.transferInfo.requestId + ')');
      }
    }

    // ✅ ตรวจสอบ ReturnLog
    console.log('\n🔙 ตรวจสอบ ReturnLog:');
    console.log('═══════════════════════════════════════════════════════════');
    
    const ReturnLog = mongoose.connection.collection('returnlogs');
    const returnLogs = await ReturnLog.find({ 
      userId: userId,
      'items.itemId': item._id.toString()
    }).toArray();
    
    if (returnLogs.length > 0) {
      console.log(`พบ ${returnLogs.length} รายการคืน:`);
      returnLogs.forEach((returnLog, idx) => {
        const returnItem = returnLog.items.find(i => i.itemId === item._id.toString());
        console.log(`\n   ${idx + 1}. ReturnLog ID: ${returnLog._id}`);
        console.log(`      status: ${returnLog.status}`);
        console.log(`      approvalStatus: ${returnItem?.approvalStatus || 'ไม่มี'}`);
        console.log(`      วันที่สร้าง: ${returnLog.createdAt}`);
        
        if (returnItem?.approvalStatus === 'approved') {
          console.log('      ❌ อุปกรณ์นี้ถูกคืนแล้ว (approved) → ไม่ควรแสดงใน Dashboard');
        } else if (returnItem?.approvalStatus === 'pending') {
          console.log('      ⏳ อุปกรณ์นี้รอการอนุมัติคืน (pending) → ควรแสดง badge "รออนุมัติคืน"');
        }
      });
    } else {
      console.log('✅ ไม่พบรายการคืน → อุปกรณ์นี้ยังอยู่กับผู้ใช้');
    }

    console.log('\n═══════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 ตัดการเชื่อมต่อ MongoDB แล้ว');
  }
}

// รับ Serial Number จาก command line
const serialNumber = process.argv[2];

if (!serialNumber) {
  console.error('❌ กรุณาระบุ Serial Number');
  console.log('การใช้งาน: node debug-owned-equipment.js <serialNumber>');
  console.log('ตัวอย่าง: node debug-owned-equipment.js 21216');
  process.exit(1);
}

debugOwnedEquipment(serialNumber);

