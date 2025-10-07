import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';

// Standalone safe migration to create indexes for transferlogs
// - Composite indexes for common queries
// - TTL partial index on transferDate with keepForever exception

async function run() {
  await dbConnect();

  const collection = mongoose.connection.collection('transferlogs');

  // Helper to create index if not exists
  async function ensureIndex(keys: any, options: any) {
    try {
      await collection.createIndex(keys, options as any);
      console.log('✔ Index ensured:', JSON.stringify({ keys, options }));
    } catch (err) {
      console.error('✖ Failed to create index', keys, options, err);
    }
  }

  // Timeline per item
  await ensureIndex({ itemId: 1, transferDate: -1 }, { name: 'itemId_transferDate_desc' });

  // Range by time
  await ensureIndex({ transferDate: -1 }, { name: 'transferDate_desc' });

  // Common filters
  await ensureIndex({ transferType: 1, processedBy: 1 }, { name: 'transferType_processedBy' });
  await ensureIndex({ categoryId: 1, transferDate: -1 }, { name: 'categoryId_transferDate_desc' });

  // Note: ไม่ใช้ TTL เพราะจะ archive แบบตัดรอบปี (1 มกราคม)
  // ใช้ yearly cleanup script แทน ที่รันวันที่ 1 มกราคมของทุกปี
  console.log('📅 Note: Using year-based archive (no TTL)');
  console.log('   Run yearly cleanup script on January 1st each year');

  console.log('🎉 transferlogs indexes setup completed');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});


