// Script to sync Mouse inventory using Next.js API
const fetch = require('node-fetch');

async function syncMouseInventory() {
  try {
    console.log('🔄 Syncing Mouse inventory...');
    
    // เรียกใช้ internal API ผ่าน helper
    const { updateInventoryMaster } = require('./src/lib/inventory-helpers');
    const dbConnect = require('./src/lib/mongodb').default;
    
    await dbConnect();
    
    // Force update InventoryMaster for Mouse
    const result = await updateInventoryMaster('Mouse', 'อุปกรณ์เสริม');
    
    console.log('✅ Mouse inventory synced successfully!');
    console.log('📊 Updated master record:', result);
    
  } catch (error) {
    console.error('❌ Error syncing Mouse inventory:', error);
  }
}

syncMouseInventory();
