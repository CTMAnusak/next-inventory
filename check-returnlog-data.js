const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://cluster0.r3yibxs.mongodb.net/inventory-management';

async function checkReturnLogData() {
  try {
    console.log('🔌 กำลังเชื่อมต่อกับ MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ เชื่อมต่อสำเร็จ\n');

    const ReturnLog = mongoose.model('ReturnLog', new mongoose.Schema({}, { strict: false }), 'returnlogs');

    // ดึงข้อมูล ReturnLog ล่าสุด 10 รายการ
    const returnLogs = await ReturnLog.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    console.log('📋 ReturnLog ล่าสุด 10 รายการ:\n');
    
    returnLogs.forEach((log, index) => {
      console.log(`\n=== รายการที่ ${index + 1} ===`);
      console.log('_id:', log._id);
      console.log('userId:', log.userId);
      console.log('returnerFirstName:', log.returnerFirstName);
      console.log('returnerLastName:', log.returnerLastName);
      console.log('returnerNickname:', log.returnerNickname);
      console.log('returnerDepartment:', log.returnerDepartment);
      console.log('returnerPhone:', log.returnerPhone);
      console.log('returnerOffice:', log.returnerOffice);
      console.log('returnDate:', log.returnDate);
      console.log('จำนวนอุปกรณ์:', log.items?.length || 0);
      
      // แสดงรายการอุปกรณ์
      if (log.items && log.items.length > 0) {
        log.items.forEach((item, i) => {
          console.log(`  รายการ ${i + 1}:`, item.itemName || item.itemId, 
                     `(SN: ${item.serialNumber || '-'}, Phone: ${item.numberPhone || '-'})`);
        });
      }
    });

    // ค้นหา userId ที่ซ้ำกัน
    console.log('\n\n📊 สรุปข้อมูลตาม userId:');
    const userIdGroups = returnLogs.reduce((acc, log) => {
      if (!acc[log.userId]) {
        acc[log.userId] = [];
      }
      acc[log.userId].push({
        _id: log._id,
        name: `${log.returnerFirstName || '-'} ${log.returnerLastName || '-'}`,
        nickname: log.returnerNickname,
        department: log.returnerDepartment,
        phone: log.returnerPhone,
        office: log.returnerOffice,
        date: log.returnDate
      });
      return acc;
    }, {});

    Object.entries(userIdGroups).forEach(([userId, logs]) => {
      console.log(`\n👤 userId: ${userId} (${logs.length} รายการ)`);
      logs.forEach((log, i) => {
        console.log(`  ${i + 1}. ${log.name} (${log.nickname}) - ${log.department} - ${log.phone}`);
        console.log(`     สาขา: ${log.office}, วันที่: ${new Date(log.date).toLocaleDateString('th-TH')}`);
      });
    });

    await mongoose.disconnect();
    console.log('\n\n✅ เสร็จสิ้น');

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
    await mongoose.disconnect();
  }
}

checkReturnLogData();

