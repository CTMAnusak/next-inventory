import dbConnect from '@/lib/mongodb';
import { updateInventoryMaster } from '@/lib/inventory-helpers';

async function fixMouseSync() {
  try {
    console.log('🔄 Starting Mouse inventory sync fix...');
    
    await dbConnect();
    
    // Force update InventoryMaster for Mouse
    await updateInventoryMaster('Mouse', 'อุปกรณ์เสริม');
    
    console.log('✅ Mouse inventory sync completed!');
    
  } catch (error) {
    console.error('❌ Error fixing Mouse sync:', error);
  }
}

// Run the fix
fixMouseSync();
