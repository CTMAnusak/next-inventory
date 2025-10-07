import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Export transferlogs by year to JSON files
// Auto-detects if today is January 1st and exports previous year
// Can also force export with --year flag

async function run() {
  await dbConnect();

  const args = process.argv.slice(2);
  const yearFlag = args.find(arg => arg.startsWith('--year='));
  const forceYear = yearFlag ? parseInt(yearFlag.split('=')[1]) : null;
  const allYears = args.includes('--all');

  const today = new Date();
  const isNewYear = today.getDate() === 1 && today.getMonth() === 0;

  // Determine which year to export
  let yearsToExport: number[] = [];

  if (allYears) {
    // Export all years
    const collection = mongoose.connection.collection('transferlogs_archive');
    const oldestDoc = await collection.findOne({}, { sort: { transferDate: 1 } });
    const newestDoc = await collection.findOne({}, { sort: { transferDate: -1 } });

    if (oldestDoc && newestDoc) {
      const startYear = new Date(oldestDoc.transferDate).getFullYear();
      const endYear = new Date(newestDoc.transferDate).getFullYear();
      for (let y = startYear; y <= endYear; y++) {
        yearsToExport.push(y);
      }
    }
  } else if (forceYear) {
    yearsToExport = [forceYear];
  } else if (isNewYear) {
    // Auto export previous year on Jan 1
    yearsToExport = [today.getFullYear() - 1];
    console.log(`🗓️  Today is January 1st - auto-exporting year ${today.getFullYear() - 1}`);
  } else {
    console.log('❌ Not January 1st. Use --year=YYYY to export specific year or --all for all years.');
    process.exit(0);
  }

  const backupDir = path.join(process.cwd(), 'backup_migration', 'transferlogs');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  for (const year of yearsToExport) {
    await exportYear(year, backupDir);
  }

  console.log('🎉 Export completed');
  process.exit(0);
}

async function exportYear(year: number, backupDir: string) {
  const collection = mongoose.connection.collection('transferlogs_archive');

  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);

  console.log(`\n📦 Exporting transferlogs for year ${year}...`);

  const docs = await collection
    .find({
      transferDate: { $gte: startDate, $lte: endDate }
    })
    .toArray();

  if (docs.length === 0) {
    console.log(`⚠️  No data found for year ${year}`);
    return;
  }

  const filename = `transferlogs_${year}.json`;
  const filepath = path.join(backupDir, filename);

  const exportData = {
    year,
    exportDate: new Date().toISOString(),
    totalRecords: docs.length,
    data: docs
  };

  fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));

  const sizeInMB = (fs.statSync(filepath).size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Exported ${docs.length} records to ${filename} (${sizeInMB} MB)`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

