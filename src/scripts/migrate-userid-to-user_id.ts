import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-management';

async function migrateUserIdToUserId() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('🔗 Connected to MongoDB');
    
    const db = client.db();
    const collection = db.collection('inventories');
    
    // Find all documents with userId field
    const documentsWithUserId = await collection.find({ userId: { $exists: true } }).toArray();
    console.log(`📊 Found ${documentsWithUserId.length} documents with userId field`);
    
    let migratedCount = 0;
    
    for (const doc of documentsWithUserId) {
      // Copy userId to user_id and remove userId
      await collection.updateOne(
        { _id: doc._id },
        {
          $set: { user_id: doc.userId },
          $unset: { userId: "" }
        }
      );
      migratedCount++;
      console.log(`✅ Migrated document ${doc._id}: userId "${doc.userId}" -> user_id "${doc.userId}"`);
    }
    
    console.log(`🎉 Migration completed! ${migratedCount} documents updated.`);
    
    // Verify migration
    const remainingUserId = await collection.countDocuments({ userId: { $exists: true } });
    const newUserIdCount = await collection.countDocuments({ user_id: { $exists: true } });
    
    console.log(`📊 Verification:`);
    console.log(`   - Documents with old "userId": ${remainingUserId}`);
    console.log(`   - Documents with new "user_id": ${newUserIdCount}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Export for API usage
export default migrateUserIdToUserId;

// Run directly if called
if (require.main === module) {
  migrateUserIdToUserId();
}
