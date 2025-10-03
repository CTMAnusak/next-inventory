/**
 * Migration Script: Add approvalStatus to existing ReturnLog items
 * 
 * This script:
 * 1. Removes the "status" field from ReturnLog documents
 * 2. Adds "approvalStatus" field to each item in the items array
 * 3. Sets approvalStatus to 'approved' if the old status was 'completed'
 * 4. Sets approvalStatus to 'pending' if the old status was 'pending' or missing
 * 
 * Run this script once after deploying the new model changes.
 */

const mongoose = require('mongoose');

// MongoDB connection string - update this if needed
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory';

async function migrateReturnLogs() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const ReturnLog = db.collection('returnlogs');

    // Get all return logs
    const returnLogs = await ReturnLog.find({}).toArray();
    console.log(`📊 Found ${returnLogs.length} return logs to migrate`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const log of returnLogs) {
      const updates = {};
      let needsUpdate = false;

      // Remove status field if exists
      if (log.status !== undefined) {
        updates.$unset = { status: '' };
        needsUpdate = true;
      }

      // Remove processedAt, processedBy, approvedAt, approvedBy from root if exists
      if (log.processedAt !== undefined) {
        if (!updates.$unset) updates.$unset = {};
        updates.$unset.processedAt = '';
        needsUpdate = true;
      }
      if (log.processedBy !== undefined) {
        if (!updates.$unset) updates.$unset = {};
        updates.$unset.processedBy = '';
        needsUpdate = true;
      }
      if (log.approvedAt !== undefined) {
        if (!updates.$unset) updates.$unset = {};
        updates.$unset.approvedAt = '';
        needsUpdate = true;
      }
      if (log.approvedBy !== undefined) {
        if (!updates.$unset) updates.$unset = {};
        updates.$unset.approvedBy = '';
        needsUpdate = true;
      }

      // Update items array
      if (log.items && Array.isArray(log.items)) {
        const updatedItems = log.items.map(item => {
          const updatedItem = { ...item };

          // Add approvalStatus if not exists
          if (!updatedItem.approvalStatus) {
            // If old status was 'completed', set all items to 'approved'
            // If old status was 'pending' or missing, set to 'pending'
            if (log.status === 'completed') {
              updatedItem.approvalStatus = 'approved';
            } else {
              updatedItem.approvalStatus = 'pending';
            }
            needsUpdate = true;
          }

          return updatedItem;
        });

        if (needsUpdate) {
          updates.$set = { items: updatedItems };
        }
      }

      // Apply updates if needed
      if (needsUpdate) {
        await ReturnLog.updateOne(
          { _id: log._id },
          updates
        );
        updatedCount++;
        console.log(`✅ Updated return log ${log._id}`);
      } else {
        skippedCount++;
        console.log(`⏭️  Skipped return log ${log._id} (already migrated)`);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Total return logs: ${returnLogs.length}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration
migrateReturnLogs();
