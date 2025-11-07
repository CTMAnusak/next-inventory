const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-management';

async function listCollections() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    const collections = await db.listCollections().toArray();
    
    console.log('📦 Collections in database:\n');
    console.log('='.repeat(80));
    
    if (collections.length === 0) {
      console.log('⚠️ No collections found!');
    } else {
      collections.forEach((collection, index) => {
        console.log(`${index + 1}. ${collection.name}`);
      });
    }
    
    console.log('='.repeat(80));
    console.log(`\nTotal: ${collections.length} collections\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

listCollections().catch(console.error);

