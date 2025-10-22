/**
 * Global Item Rename Migration Script
 * 
 * สคริปต์สำหรับเปลี่ยนชื่ออุปกรณ์ในทุก collections ทั้งหมด
 * รองรับ: Backup, Rollback, Dry-run, Progress tracking
 */

import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';

export interface RenameResult {
  success: boolean;
  totalCollections: number;
  collectionsProcessed: number;
  totalDocuments: number;
  documentsUpdated: number;
  errors: string[];
  details: CollectionResult[];
  backupId?: string;
  duration: number;
  dryRun: boolean;
}

interface CollectionResult {
  collection: string;
  documentsFound: number;
  documentsUpdated: number;
  fields: string[];
  error?: string;
}

export interface RenameOptions {
  dryRun?: boolean;
  createBackup?: boolean;
  batchSize?: number;
}

/**
 * สร้าง backup ของข้อมูลที่จะเปลี่ยน
 */
async function createBackup(db: mongoose.mongo.Db, itemName: string): Promise<string> {
  const backupId = `rename_backup_${itemName}_${Date.now()}`;
  const backupCollection = db.collection('rename_backups');

  const backupData = {
    backupId,
    itemName,
    createdAt: new Date(),
    collections: {} as any
  };

  // Backup data from each collection
  const collections = ['inventoryitems', 'inventorymasters', 'inventories', 'requestlogs', 'returnlogs', 'transferlogs'];
  
  for (const collectionName of collections) {
    const collection = db.collection(collectionName);
    let query: any = {};
    
    if (collectionName === 'requestlogs' || collectionName === 'returnlogs') {
      query = { 'items.itemName': itemName };
    } else if (collectionName === 'transferlogs') {
      query = { $or: [{ fromItemName: itemName }, { toItemName: itemName }] };
    } else {
      query = { itemName: itemName };
    }

    const documents = await collection.find(query).toArray();
    backupData.collections[collectionName] = documents;
  }

  await backupCollection.insertOne(backupData);
  return backupId;
}

/**
 * ประมวลผล collection เดียว
 */
async function processCollection(
  db: mongoose.mongo.Db,
  collectionInfo: any,
  oldName: string,
  newName: string,
  dryRun: boolean,
  batchSize: number
): Promise<CollectionResult> {
  
  const collection = db.collection(collectionInfo.name);
  
  // นับจำนวน documents ที่จะได้รับผลกระทบ
  const documentsFound = await collection.countDocuments(collectionInfo.query);
  
  
  if (documentsFound === 0) {
    return {
      collection: collectionInfo.name,
      documentsFound: 0,
      documentsUpdated: 0,
      fields: collectionInfo.fields
    };
  }

  let documentsUpdated = 0;

  if (!dryRun) {
    // สำหรับ simple fields (ไม่ใช่ array)
    if (collectionInfo.fields.some((f: string) => !f.includes('.'))) {
      for (const field of collectionInfo.fields) {
        if (!field.includes('.')) {
          const updateQuery: any = {};
          updateQuery[field] = newName;
          
          const updateResult = await collection.updateMany(
            { [field]: oldName },
            { $set: updateQuery }
          );
          documentsUpdated += updateResult.modifiedCount;
        }
      }
    }

    // สำหรับ nested fields ใน arrays (เช่น items.itemName)
    if (collectionInfo.fields.some((f: string) => f.includes('items.'))) {
      // Update array elements
      const updateResult = await collection.updateMany(
        { 'items.itemName': oldName },
        { $set: { 'items.$[elem].itemName': newName } },
        { arrayFilters: [{ 'elem.itemName': oldName }] }
      );
      documentsUpdated += updateResult.modifiedCount;
    }

    // สำหรับ transferlogs ที่มี fromItemName และ toItemName
    if (collectionInfo.name === 'transferlogs') {
      // Update fromItemName
      const fromResult = await collection.updateMany(
        { fromItemName: oldName },
        { $set: { fromItemName: newName } }
      );
      
      // Update toItemName
      const toResult = await collection.updateMany(
        { toItemName: oldName },
        { $set: { toItemName: newName } }
      );
      
      documentsUpdated += fromResult.modifiedCount + toResult.modifiedCount;
    }
  } else {
    // ใน dry run mode, จำลองการ update
    documentsUpdated = documentsFound;
  }

  return {
    collection: collectionInfo.name,
    documentsFound,
    documentsUpdated,
    fields: collectionInfo.fields
  };
}

/**
 * เปลี่ยนชื่ออุปกรณ์ในทุก collections
 */
export async function renameItemGlobally(
  oldName: string, 
  newName: string, 
  options: RenameOptions = {}
): Promise<RenameResult> {
  const startTime = Date.now();
  const { dryRun = false, createBackup: shouldCreateBackup = false, batchSize = 1000 } = options;
  
  const result: RenameResult = {
    success: false,
    totalCollections: 0,
    collectionsProcessed: 0,
    totalDocuments: 0,
    documentsUpdated: 0,
    errors: [],
    details: [],
    duration: 0,
    dryRun
  };

  try {
    
    await dbConnect();
    
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection failed');
    }
    

    // 1. สร้าง backup ถ้าไม่ใช่ dry run
    if (shouldCreateBackup && !dryRun) {
      result.backupId = await createBackup(db, oldName);
    }

    // 2. กำหนด collections และ fields ที่ต้องเปลี่ยน
    const collectionsToUpdate = [
      {
        name: 'inventoryitems',
        fields: ['itemName'],
        query: { itemName: oldName }
      },
      {
        name: 'inventorymasters', 
        fields: ['itemName'],
        query: { itemName: oldName }
      },
      {
        name: 'inventories',
        fields: ['itemName'],
        query: { itemName: oldName }
      },
      {
        name: 'requestlogs',
        fields: ['items.itemName'],
        query: { 'items.itemName': oldName }
      },
      {
        name: 'returnlogs',
        fields: ['items.itemName'], 
        query: { 'items.itemName': oldName }
      },
      {
        name: 'transferlogs',
        fields: ['fromItemName', 'toItemName'],
        query: { 
          $or: [
            { fromItemName: oldName },
            { toItemName: oldName }
          ]
        }
      }
    ];

    result.totalCollections = collectionsToUpdate.length;
    

    // 3. ประมวลผลแต่ละ collection
    for (const collectionInfo of collectionsToUpdate) {
      try {
        
        const collectionResult = await processCollection(
          db,
          collectionInfo,
          oldName,
          newName,
          dryRun,
          batchSize
        );

        result.details.push(collectionResult);
        result.totalDocuments += collectionResult.documentsFound;
        result.documentsUpdated += collectionResult.documentsUpdated;
        result.collectionsProcessed++;


      } catch (error) {
        const errorMsg = `Error in ${collectionInfo.name}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        result.errors.push(errorMsg);
        
        result.details.push({
          collection: collectionInfo.name,
          documentsFound: 0,
          documentsUpdated: 0,
          fields: collectionInfo.fields,
          error: errorMsg
        });
      }
    }

    // 4. สรุปผลลัพธ์
    result.success = result.errors.length === 0;
    result.duration = Date.now() - startTime;


    if (result.errors.length > 0) {
      console.log(`⚠️ Errors encountered: ${result.errors.length}`);
      result.errors.forEach(error => console.log(`   - ${error}`));
    }

    return result;

  } catch (error) {
    result.success = false;
    result.duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMsg);
    console.error(`❌ Global rename failed: ${errorMsg}`);
    return result;
  }
}

/**
 * Rollback การเปลี่ยนแปลงจาก backup
 */
export async function rollbackRename(backupId: string): Promise<boolean> {
  try {
    
    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection failed');
    }

    const backupCollection = db.collection('rename_backups');
    const backup = await backupCollection.findOne({ backupId });

    if (!backup) {
      throw new Error(`Backup with ID ${backupId} not found`);
    }

    // Restore each collection
    for (const [collectionName, documents] of Object.entries(backup.collections)) {
      const collection = db.collection(collectionName);
      const docs = documents as any[];
      
      if (docs.length > 0) {
        // Delete current documents and restore backup
        const ids = docs.map(doc => doc._id);
        await collection.deleteMany({ _id: { $in: ids } });
        await collection.insertMany(docs);
        
      }
    }

    return true;

  } catch (error) {
    console.error(`❌ Rollback failed:`, error);
    return false;
  }
}

