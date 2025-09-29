import dbConnect from '@/lib/mongodb';
import { updateInventoryMaster } from '@/lib/inventory-helpers';

async function fixMouseSync() {
  try {
    
    await dbConnect();
    
    // Force update InventoryMaster for Mouse
    await updateInventoryMaster('Mouse', 'อุปกรณ์เสริม');
    
    
  } catch (error) {
    console.error('❌ Error fixing Mouse sync:', error);
  }
}

// Run the fix
fixMouseSync();
