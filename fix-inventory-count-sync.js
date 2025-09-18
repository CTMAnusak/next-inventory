/**
 * Script ทั่วไปสำหรับแก้ไขปัญหาการนับจำนวนอุปกรณ์ที่ไม่ตรงกัน
 * ระหว่าง inventoryitems และ inventorymasters
 * 
 * ปัญหา: มีรายการที่ถูก soft delete (status = 'deleted') ยังคงอยู่ใน inventoryitems
 * วิธีแก้: ลบรายการที่ถูก soft delete ออกจาก database จริงและซิงค์ข้อมูล
 * 
 * การใช้งาน:
 * - node fix-inventory-count-sync.js                           // แก้ไขทุกรายการ
 * - node fix-inventory-count-sync.js --item="Dell01"          // แก้ไขเฉพาะ Dell01
 * - node fix-inventory-count-sync.js --check-only             // เช็คปัญหาอย่างเดียว ไม่แก้ไข
 * - node fix-inventory-count-sync.js --category="คอมพิวเตอร์"   // แก้ไขเฉพาะหมวดหมู่
 */

const { MongoClient } = require('mongodb');

// ตั้งค่า MongoDB connection
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-management';
const client = new MongoClient(uri);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  itemName: null,
  category: null,
  checkOnly: false,
  help: false
};

for (const arg of args) {
  if (arg.startsWith('--item=')) {
    options.itemName = arg.split('=')[1];
  } else if (arg.startsWith('--category=')) {
    options.category = arg.split('=')[1];
  } else if (arg === '--check-only') {
    options.checkOnly = true;
  } else if (arg === '--help' || arg === '-h') {
    options.help = true;
  }
}

function showHelp() {
  console.log(`
📋 Fix Inventory Count Sync - คำแนะนำการใช้งาน

🎯 วัตถุประสงค์:
   แก้ไขปัญหาการนับจำนวนอุปกรณ์ที่ไม่ตรงกันระหว่าง inventoryitems และ inventorymasters
   เนื่องจากมีรายการที่ถูก soft delete ยังคงอยู่ใน database

🚀 การใช้งาน:
   node fix-inventory-count-sync.js [ตัวเลือก]

📝 ตัวเลือก:
   --item="ชื่ออุปกรณ์"        แก้ไขเฉพาะอุปกรณ์ที่ระบุ (เช่น --item="Dell01")
   --category="หมวดหมู่"      แก้ไขเฉพาะหมวดหมู่ที่ระบุ
   --check-only              เช็คปัญหาอย่างเดียว ไม่ทำการแก้ไข
   --help, -h               แสดงคำแนะนำนี้

💡 ตัวอย่าง:
   node fix-inventory-count-sync.js                                    # แก้ไขทุกรายการ
   node fix-inventory-count-sync.js --item="Dell01"                   # แก้ไขเฉพาะ Dell01
   node fix-inventory-count-sync.js --category="คอมพิวเตอร์และอุปกรณ์ต่อพ่วง"  # แก้ไขเฉพาะหมวดหมู่
   node fix-inventory-count-sync.js --check-only                      # เช็คปัญหาอย่างเดียว
   node fix-inventory-count-sync.js --item="Mouse01" --check-only      # เช็คเฉพาะ Mouse01
`);
}

async function checkInventorySync() {
  const db = client.db();
  const inventoryItems = db.collection('inventoryitems');
  const inventoryMasters = db.collection('inventorymasters');
  
  // สร้าง query สำหรับค้นหา
  let itemQuery = {};
  if (options.itemName) itemQuery.itemName = options.itemName;
  if (options.category) itemQuery.category = options.category;
  
  console.log('🔍 ตรวจสอบปัญหาการซิงค์ข้อมูล...');
  if (options.itemName) console.log(`🎯 เฉพาะอุปกรณ์: ${options.itemName}`);
  if (options.category) console.log(`📂 เฉพาะหมวดหมู่: ${options.category}`);
  
  // หาทุกรายการใน inventoryitems
  const allItems = await inventoryItems.find(itemQuery).toArray();
  
  // จัดกลุ่มตาม itemName + category
  const itemGroups = {};
  for (const item of allItems) {
    const key = `${item.itemName}|${item.category}`;
    if (!itemGroups[key]) {
      itemGroups[key] = {
        itemName: item.itemName,
        category: item.category,
        allItems: [],
        activeItems: [],
        softDeletedItems: []
      };
    }
    
    itemGroups[key].allItems.push(item);
    
    if (item.status === 'deleted') {
      itemGroups[key].softDeletedItems.push(item);
    } else {
      itemGroups[key].activeItems.push(item);
    }
  }
  
  console.log(`\n📊 พบรายการทั้งหมด: ${Object.keys(itemGroups).length} ประเภท`);
  
  const problemItems = [];
  
  // ตรวจสอบแต่ละกลุ่ม
  for (const [key, group] of Object.entries(itemGroups)) {
    const masterItem = await inventoryMasters.findOne({
      itemName: group.itemName,
      category: group.category
    });
    
    const totalInItems = group.allItems.length;
    const activeInItems = group.activeItems.length;
    const softDeletedCount = group.softDeletedItems.length;
    const totalInMaster = masterItem ? masterItem.totalQuantity : 0;
    
    console.log(`\n📦 ${group.itemName} (${group.category}):`);
    console.log(`   📋 inventoryitems: ${totalInItems} รายการ (${activeInItems} active, ${softDeletedCount} soft-deleted)`);
    console.log(`   📊 inventorymasters: ${totalInMaster} รายการ`);
    
    // ตรวจสอบว่ามีปัญหาหรือไม่
    const hasProblem = softDeletedCount > 0 || activeInItems !== totalInMaster;
    
    if (hasProblem) {
      console.log(`   ⚠️  มีปัญหา: จำนวนไม่ตรงกัน หรือมีรายการที่ถูก soft delete`);
      problemItems.push({
        ...group,
        totalInItems,
        activeInItems,
        softDeletedCount,
        totalInMaster,
        masterItem
      });
    } else {
      console.log(`   ✅ ปกติ: จำนวนตรงกัน`);
    }
  }
  
  return problemItems;
}

async function fixInventorySync(problemItems) {
  const db = client.db();
  const inventoryItems = db.collection('inventoryitems');
  const inventoryMasters = db.collection('inventorymasters');
  const transferLogs = db.collection('transferlogs');
  
  console.log(`\n🔧 เริ่มแก้ไขปัญหา: ${problemItems.length} รายการ`);
  
  let totalCleaned = 0;
  let totalUpdated = 0;
  
  for (const problem of problemItems) {
    console.log(`\n🛠️  แก้ไข: ${problem.itemName} (${problem.category})`);
    
    // 1. สร้าง transfer log สำหรับรายการที่จะลบ
    if (problem.softDeletedItems.length > 0) {
      console.log(`   📝 สร้าง transfer log สำหรับ ${problem.softDeletedItems.length} รายการที่จะลบ...`);
      
      for (const item of problem.softDeletedItems) {
        try {
          await transferLogs.insertOne({
            itemId: item._id.toString(),
            itemName: item.itemName,
            category: item.category,
            serialNumber: item.serialNumber || 'No SN',
            numberPhone: item.numberPhone || undefined,
            transferType: 'ownership_change',
            fromOwnership: { 
              ownerType: 'admin_stock'
            },
            toOwnership: { 
              ownerType: 'admin_stock'
            },
            transferDate: new Date(),
            processedBy: 'system_cleanup_script',
            reason: `Database cleanup - permanently removing soft-deleted item (originally deleted: ${item.deleteReason || 'Unknown reason'})`,
            notes: `System cleanup script to fix count discrepancy - item was soft-deleted on ${item.deletedAt ? new Date(item.deletedAt).toISOString() : 'unknown date'}`,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        } catch (logError) {
          console.log(`   ❌ ไม่สามารถสร้าง transfer log สำหรับ ${item._id}: ${logError.message}`);
        }
      }
      
      // 2. ลบรายการที่ถูก soft delete
      console.log(`   🗑️  ลบรายการที่ถูก soft delete...`);
      const deleteResult = await inventoryItems.deleteMany({
        itemName: problem.itemName,
        category: problem.category,
        status: 'deleted'
      });
      
      console.log(`   ✅ ลบสำเร็จ: ${deleteResult.deletedCount} รายการ`);
      totalCleaned += deleteResult.deletedCount;
    }
    
    // 3. อัพเดต inventorymasters
    console.log(`   🔄 อัพเดต inventorymasters...`);
    
    // นับจำนวนรายการที่เหลือ
    const remainingItems = await inventoryItems.find({
      itemName: problem.itemName,
      category: problem.category,
      status: { $ne: 'deleted' }
    }).toArray();
    
    const adminStockItems = remainingItems.filter(item => item.currentOwnership?.ownerType === 'admin_stock');
    const userOwnedItems = remainingItems.filter(item => item.currentOwnership?.ownerType === 'user_owned');
    
    const updateData = {
      totalQuantity: remainingItems.length,
      availableQuantity: adminStockItems.length,
      userOwnedQuantity: userOwnedItems.length,
      updatedAt: new Date()
    };
    
    if (problem.masterItem) {
      // อัพเดตรายการที่มีอยู่
      const updateResult = await inventoryMasters.updateOne(
        {
          itemName: problem.itemName,
          category: problem.category
        },
        { $set: updateData }
      );
      
      if (updateResult.modifiedCount > 0) {
        console.log(`   ✅ อัพเดต inventorymasters สำเร็จ`);
        totalUpdated++;
      }
    } else {
      // สร้างรายการใหม่ถ้าไม่มี
      await inventoryMasters.insertOne({
        itemName: problem.itemName,
        category: problem.category,
        hasSerialNumber: false,
        ...updateData,
        createdAt: new Date()
      });
      console.log(`   ✅ สร้าง inventorymasters รายการใหม่`);
      totalUpdated++;
    }
    
    console.log(`   📊 ผลลัพธ์: ${remainingItems.length} รายการ (${adminStockItems.length} admin stock, ${userOwnedItems.length} user owned)`);
  }
  
  return { totalCleaned, totalUpdated };
}

async function main() {
  try {
    if (options.help) {
      showHelp();
      return;
    }
    
    console.log('🔧 Fix Inventory Count Sync - เริ่มต้นการทำงาน');
    console.log('=' .repeat(60));
    
    await client.connect();
    console.log('✅ เชื่อมต่อ MongoDB สำเร็จ');
    
    // ตรวจสอบปัญหา
    const problemItems = await checkInventorySync();
    
    if (problemItems.length === 0) {
      console.log('\n🎉 ไม่พบปัญหา! ข้อมูลทุกรายการซิงค์กันแล้ว');
      return;
    }
    
    console.log(`\n⚠️  พบปัญหา: ${problemItems.length} รายการ`);
    
    if (options.checkOnly) {
      console.log('\n📋 โหมดตรวจสอบเท่านั้น - ไม่ทำการแก้ไข');
      console.log('💡 หากต้องการแก้ไข ให้รันคำสั่งโดยไม่ใส่ --check-only');
      return;
    }
    
    // ขอยืนยันก่อนแก้ไข (ถ้าไม่ได้ระบุรายการเฉพาะ)
    if (!options.itemName && !options.category) {
      console.log('\n⚠️  คุณกำลังจะแก้ไขทุกรายการในระบบ');
      console.log('💡 หากต้องการแก้ไขเฉพาะรายการใดรายการหนึ่ง ให้ใช้ --item="ชื่ออุปกรณ์"');
      console.log('🔄 กำลังดำเนินการใน 3 วินาที...');
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // แก้ไขปัญหา
    const result = await fixInventorySync(problemItems);
    
    // แสดงผลสรุป
    console.log('\n🎉 แก้ไขปัญหาเสร็จสิ้น!');
    console.log('=' .repeat(60));
    console.log(`📊 สรุปผลการทำงาน:`);
    console.log(`   🗑️  รายการที่ลบออก: ${result.totalCleaned} รายการ`);
    console.log(`   🔄 inventorymasters ที่อัพเดต: ${result.totalUpdated} รายการ`);
    console.log(`   ✅ รายการที่แก้ไข: ${problemItems.length} ประเภท`);
    
    // ตรวจสอบผลลัพธ์อีกครั้ง
    console.log('\n🔍 ตรวจสอบผลลัพธ์สุดท้าย...');
    const finalCheck = await checkInventorySync();
    
    if (finalCheck.length === 0) {
      console.log('✅ สำเร็จ! ข้อมูลทุกรายการซิงค์กันแล้ว');
    } else {
      console.log(`⚠️  ยังพบปัญหา: ${finalCheck.length} รายการ - อาจต้องตรวจสอบเพิ่มเติม`);
    }
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 ปิดการเชื่อมต่อ MongoDB');
  }
}

// เรียกใช้ script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkInventorySync, fixInventorySync };
