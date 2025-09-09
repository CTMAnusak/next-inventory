// Script to fix Mouse inventory sync
const { MongoClient } = require('mongodb');

async function fixMouseInventory() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('inventory'); // เปลี่ยนชื่อ DB ตามที่ใช้จริง
    
    // 1. ตรวจสอบ InventoryItem ทั้งหมดสำหรับ Mouse
    const mouseItems = await db.collection('inventoryitems').find({
      itemName: 'Mouse'
    }).toArray();
    
    console.log('🔍 Mouse InventoryItems:', mouseItems.length);
    mouseItems.forEach((item, index) => {
      console.log(`${index + 1}. SN: ${item.serialNumber || 'NO SN'}, Owner: ${item.currentOwnership.ownerType}, Status: ${item.status}`);
    });
    
    // 2. คำนวณข้อมูลใหม่
    const totalQuantity = mouseItems.length;
    const adminStockItems = mouseItems.filter(item => item.currentOwnership.ownerType === 'admin_stock');
    const userOwnedItems = mouseItems.filter(item => item.currentOwnership.ownerType === 'user_owned');
    const hasSerialNumber = mouseItems.some(item => item.serialNumber);
    
    const statusBreakdown = {
      active: mouseItems.filter(item => item.status === 'active').length,
      maintenance: mouseItems.filter(item => item.status === 'maintenance').length,
      damaged: mouseItems.filter(item => item.status === 'damaged').length,
      retired: mouseItems.filter(item => item.status === 'retired').length
    };
    
    const newData = {
      totalQuantity,
      availableQuantity: adminStockItems.length,
      userOwnedQuantity: userOwnedItems.length,
      hasSerialNumber,
      statusBreakdown,
      lastUpdated: new Date()
    };
    
    console.log('📊 New InventoryMaster data:', newData);
    
    // 3. อัปเดต InventoryMaster
    const result = await db.collection('inventorymasters').updateOne(
      { itemName: 'Mouse' },
      { $set: newData }
    );
    
    console.log('✅ Updated InventoryMaster:', result.modifiedCount, 'documents');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

fixMouseInventory();
