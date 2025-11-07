const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-management';

async function checkIndexes() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    // Collections to check
    const collections = [
      'inventoryitems',
      'returnlogs',
      'requestlogs',
      'offices',
      'users',
      'inventoryconfigs'
    ];
    
    console.log('📊 Checking Database Indexes...\n');
    console.log('='.repeat(80));
    
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const indexes = await collection.indexes();
        
        console.log(`\n📦 Collection: ${collectionName}`);
        console.log('-'.repeat(80));
        
        if (indexes.length === 0) {
          console.log('  ⚠️ No indexes found!');
        } else {
          indexes.forEach((index, i) => {
            const keys = Object.keys(index.key).map(k => {
              const direction = index.key[k] === 1 ? 'ASC' : index.key[k] === -1 ? 'DESC' : index.key[k];
              return `${k}:${direction}`;
            }).join(', ');
            
            const indexName = index.name;
            const unique = index.unique ? ' [UNIQUE]' : '';
            const sparse = index.sparse ? ' [SPARSE]' : '';
            
            console.log(`  ${i + 1}. ${indexName}${unique}${sparse}`);
            console.log(`     Keys: ${keys}`);
          });
        }
        
        // Check collection stats
        const stats = await collection.stats();
        console.log(`\n  📈 Stats:`);
        console.log(`     Documents: ${stats.count.toLocaleString()}`);
        console.log(`     Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`     Avg Doc Size: ${(stats.avgObjSize / 1024).toFixed(2)} KB`);
        
      } catch (error) {
        console.log(`  ❌ Error checking collection: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    
    // Recommendations
    console.log('\n💡 Index Recommendations:');
    console.log('-'.repeat(80));
    
    const inventoryItems = db.collection('inventoryitems');
    const inventoryIndexes = await inventoryItems.indexes();
    const hasOwnershipIndex = inventoryIndexes.some(idx => 
      idx.key['currentOwnership.ownerType'] && idx.key['currentOwnership.userId']
    );
    
    if (!hasOwnershipIndex) {
      console.log('❌ CRITICAL: Missing compound index on inventoryitems');
      console.log('   Recommendation: Create index on currentOwnership.ownerType + currentOwnership.userId');
      console.log('   Command: db.inventoryitems.createIndex({ "currentOwnership.ownerType": 1, "currentOwnership.userId": 1 })');
    } else {
      console.log('✅ Ownership index exists on inventoryitems');
    }
    
    const returnLogs = db.collection('returnlogs');
    const returnIndexes = await returnLogs.indexes();
    const hasUserIdIndex = returnIndexes.some(idx => idx.key['userId']);
    
    if (!hasUserIdIndex) {
      console.log('⚠️ WARNING: Missing index on returnlogs.userId');
      console.log('   Recommendation: Create index on userId for faster return log queries');
      console.log('   Command: db.returnlogs.createIndex({ "userId": 1 })');
    } else {
      console.log('✅ userId index exists on returnlogs');
    }
    
    const requestLogs = db.collection('requestlogs');
    const requestIndexes = await requestLogs.indexes();
    const hasRequestUserIndex = requestIndexes.some(idx => idx.key['userId']);
    
    if (!hasRequestUserIndex) {
      console.log('⚠️ WARNING: Missing index on requestlogs.userId');
      console.log('   Recommendation: Create index on userId for faster request log queries');
      console.log('   Command: db.requestlogs.createIndex({ "userId": 1 })');
    } else {
      console.log('✅ userId index exists on requestlogs');
    }
    
    const offices = db.collection('offices');
    const officeIndexes = await offices.indexes();
    const hasOfficeIdIndex = officeIndexes.some(idx => idx.key['office_id']);
    
    if (!hasOfficeIdIndex) {
      console.log('❌ CRITICAL: Missing index on offices.office_id');
      console.log('   Recommendation: Create unique index on office_id for faster office lookups');
      console.log('   Command: db.offices.createIndex({ "office_id": 1 }, { unique: true })');
    } else {
      console.log('✅ office_id index exists on offices');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✨ Database index check completed!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the check
checkIndexes().catch(console.error);

