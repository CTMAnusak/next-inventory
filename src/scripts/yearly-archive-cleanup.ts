import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

/**
 * Yearly Archive & Cleanup Script
 * รันวันที่ 1 มกราคมของทุกปี เพื่อ:
 * 1. Export ข้อมูลปีที่แล้วไปไฟล์ JSON
 * 2. ย้ายข้อมูลปีที่แล้วไป transferlogs_archive
 * 3. ลบข้อมูลปีที่แล้วออกจาก transferlogs
 * 
 * ตัวอย่าง: รันวันที่ 1 มกราคม 2026
 * - Export ข้อมูล 1/1/2025 00:00 ถึง 31/12/2025 23:59
 * - เก็บเป็นไฟล์ transferlogs_2025.json
 * - ย้ายไป transferlogs_archive และลบออกจาก transferlogs
 */

async function run() {
  await dbConnect();

  const args = process.argv.slice(2);
  const forceYearFlag = args.find(arg => arg.startsWith('--year='));
  const forceYear = forceYearFlag ? parseInt(forceYearFlag.split('=')[1]) : null;
  const skipArchive = args.includes('--skip-archive');
  const skipExport = args.includes('--skip-export');
  const skipDelete = args.includes('--skip-delete');

  const today = new Date();
  const isJanuary1st = today.getDate() === 1 && today.getMonth() === 0;

  let yearToProcess: number;

  if (forceYear) {
    yearToProcess = forceYear;
    console.log(`🔧 Force mode: Processing year ${yearToProcess}`);
  } else if (isJanuary1st) {
    yearToProcess = today.getFullYear() - 1;
    console.log(`📅 Today is January 1st - auto-processing year ${yearToProcess}`);
  } else {
    console.log('❌ Not January 1st. Use --year=YYYY to force process a specific year.');
    console.log('   Example: npx tsx src/scripts/yearly-archive-cleanup.ts --year=2025');
    process.exit(0);
  }

  // Date range for the year
  const startDate = new Date(yearToProcess, 0, 1, 0, 0, 0); // 1 มกราคม 00:00
  const endDate = new Date(yearToProcess, 11, 31, 23, 59, 59); // 31 ธันวาคม 23:59

  console.log(`\n📦 Processing transferlogs for year ${yearToProcess}`);
  console.log(`   Start: ${startDate.toISOString()}`);
  console.log(`   End: ${endDate.toISOString()}`);

  const mainCollection = mongoose.connection.collection('transferlogs');
  const archiveCollection = mongoose.connection.collection('transferlogs_archive');

  // Count documents
  const count = await mainCollection.countDocuments({
    transferDate: { $gte: startDate, $lte: endDate }
  });

  if (count === 0) {
    console.log(`⚠️  No data found for year ${yearToProcess}`);
    process.exit(0);
  }

  console.log(`📊 Found ${count} records to process\n`);

  // Step 1: Export to JSON file
  if (!skipExport) {
    console.log('📝 Step 1: Exporting to JSON file...');
    await exportToFile(mainCollection, yearToProcess, startDate, endDate);
  } else {
    console.log('⏭️  Step 1: Skipped (--skip-export)');
  }

  // Step 2: Move to archive collection
  if (!skipArchive) {
    console.log('\n📤 Step 2: Moving to transferlogs_archive...');
    await moveToArchive(mainCollection, archiveCollection, startDate, endDate);
  } else {
    console.log('\n⏭️  Step 2: Skipped (--skip-archive)');
  }

  // Step 3: Delete from main collection
  if (!skipDelete) {
    console.log('\n🗑️  Step 3: Deleting from transferlogs...');
    await deleteFromMain(mainCollection, startDate, endDate);
  } else {
    console.log('\n⏭️  Step 3: Skipped (--skip-delete)');
  }

  console.log('\n🎉 Yearly archive & cleanup completed!');
  console.log(`✅ Year ${yearToProcess} data processed successfully`);
  process.exit(0);
}

async function exportToFile(
  collection: any,
  year: number,
  startDate: Date,
  endDate: Date
) {
  const backupDir = path.join(process.cwd(), 'backup_migration', 'transferlogs');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const docs = await collection
    .find({ transferDate: { $gte: startDate, $lte: endDate } })
    .toArray();

  const filename = `transferlogs_${year}.json`;
  const filepath = path.join(backupDir, filename);

  const exportData = {
    year,
    exportDate: new Date().toISOString(),
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    totalRecords: docs.length,
    data: docs
  };

  fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));

  const sizeInMB = (fs.statSync(filepath).size / (1024 * 1024)).toFixed(2);
  console.log(`   ✅ Exported ${docs.length} records to ${filename} (${sizeInMB} MB)`);
}

async function moveToArchive(
  mainCollection: any,
  archiveCollection: any,
  startDate: Date,
  endDate: Date
) {
  const docs = await mainCollection
    .find({ transferDate: { $gte: startDate, $lte: endDate } })
    .toArray();

  if (docs.length > 0) {
    try {
      await archiveCollection.insertMany(docs, { ordered: false });
      console.log(`   ✅ Moved ${docs.length} records to transferlogs_archive`);
    } catch (err: any) {
      // Handle duplicates
      if (err.code === 11000) {
        const inserted = docs.length - (err.writeErrors?.length || 0);
        console.log(`   ✅ Moved ${inserted} records (skipped ${err.writeErrors?.length || 0} duplicates)`);
      } else {
        throw err;
      }
    }
  }
}

async function deleteFromMain(
  mainCollection: any,
  startDate: Date,
  endDate: Date
) {
  const result = await mainCollection.deleteMany({
    transferDate: { $gte: startDate, $lte: endDate }
  });

  console.log(`   ✅ Deleted ${result.deletedCount} records from transferlogs`);
}

run().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});

