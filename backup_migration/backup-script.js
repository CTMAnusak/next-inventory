const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// MongoDB connection string from your env
const uri = 'mongodb+srv://vsq-admin:vsqWedYykRQQjZtmHX9@cluster0.r3yibxs.mongodb.net/inventory-management?retryWrites=true&w=majority&appName=Cluster0';

// Function to manage backup versions (keep only 2 versions)
function manageBackupVersions(collectionName) {
  const backupDir = __dirname;
  const files = fs.readdirSync(backupDir);
  
  // Find all backup files for this collection
  const backupFiles = files
    .filter(file => file.startsWith(`backup_`) && file.includes(`_${collectionName}.json`))
    .map(file => {
      const fullPath = path.join(backupDir, file);
      const stats = fs.statSync(fullPath);
      return {
        name: file,
        path: fullPath,
        created: stats.birthtime
      };
    })
    .sort((a, b) => b.created - a.created); // Sort by creation time (newest first)
  
  // Keep only latest 2 versions, delete the rest
  if (backupFiles.length > 2) {
    const filesToDelete = backupFiles.slice(2); // Keep first 2, delete rest
    console.log(`🗑️  Cleaning up old backups for ${collectionName}:`);
    
    filesToDelete.forEach(file => {
      fs.unlinkSync(file.path);
      console.log(`   ❌ Deleted: ${file.name}`);
    });
  }
}

// Function to log backup activity
function logBackupActivity(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${isError ? 'ERROR' : 'INFO'}: ${message}\n`;
  
  const logFile = path.join(__dirname, 'backup_log.txt');
  fs.appendFileSync(logFile, logEntry);
  
  if (isError) {
    console.error(message);
  } else {
    console.log(message);
  }
}

async function createBackup() {
  const client = new MongoClient(uri);
  
  try {
    logBackupActivity('🔗 Starting backup process...');
    logBackupActivity('🔗 Connecting to MongoDB...');
    await client.connect();
    logBackupActivity('✅ Connected successfully');
    
    const db = client.db();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    // Collections to backup
    const collections = [
      'inventoryitems',
      'requestlogs', 
      'returnlogs',
      'issuelogs'
    ];
    
    logBackupActivity(`📦 Starting backup of ${collections.length} collections...`);
    
    for (const collectionName of collections) {
      logBackupActivity(`🔄 Backing up ${collectionName}...`);
      
      const collection = db.collection(collectionName);
      const documents = await collection.find({}).toArray();
      
      // Create new backup file
      const filename = `backup_${timestamp}_${collectionName}.json`;
      const filepath = path.join(__dirname, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(documents, null, 2));
      logBackupActivity(`✅ ${collectionName}: ${documents.length} documents → ${filename}`);
      
      // Clean up old backup files (keep only 2 versions)
      manageBackupVersions(collectionName);
    }
    
    logBackupActivity('🎉 Backup completed successfully!');
    logBackupActivity(`📁 Backup files saved in: ${__dirname}`);
    
  } catch (error) {
    logBackupActivity(`❌ Backup failed: ${error.message}`, true);
    process.exit(1);
  } finally {
    await client.close();
    logBackupActivity('🔌 Disconnected from MongoDB');
  }
}

createBackup();
