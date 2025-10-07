import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Delete transferlogs from transferlogs_archive after verifying export files exist
// Usage: npx tsx src/scripts/cleanup-archived-transferlogs.ts --year=2023
// Or: npx tsx src/scripts/cleanup-archived-transferlogs.ts --before=2024 (delete all before 2024)

async function run() {
  await dbConnect();

  const args = process.argv.slice(2);
  const yearFlag = args.find(arg => arg.startsWith('--year='));
  const beforeFlag = args.find(arg => arg.startsWith('--before='));
  const force = args.includes('--force');

  if (!yearFlag && !beforeFlag) {
    console.log('❌ Please specify --year=YYYY or --before=YYYY');
    console.log('Examples:');
    console.log('  npx tsx src/scripts/cleanup-archived-transferlogs.ts --year=2023');
    console.log('  npx tsx src/scripts/cleanup-archived-transferlogs.ts --before=2024');
    process.exit(1);
  }

  const backupDir = path.join(process.cwd(), 'backup_migration', 'transferlogs');
  const collection = mongoose.connection.collection('transferlogs_archive');

  let yearsToDelete: number[] = [];

  if (yearFlag) {
    const year = parseInt(yearFlag.split('=')[1]);
    yearsToDelete = [year];
  } else if (beforeFlag) {
    const beforeYear = parseInt(beforeFlag.split('=')[1]);
    // Find all years before specified year
    const oldestDoc = await collection.findOne({}, { sort: { transferDate: 1 } });
    if (oldestDoc) {
      const startYear = new Date(oldestDoc.transferDate).getFullYear();
      for (let y = startYear; y < beforeYear; y++) {
        yearsToDelete.push(y);
      }
    }
  }

  if (yearsToDelete.length === 0) {
    console.log('❌ No years to delete');
    process.exit(0);
  }

  // Verify backup files exist
  console.log('\n🔍 Verifying backup files...');
  for (const year of yearsToDelete) {
    const filename = `transferlogs_${year}.json`;
    const filepath = path.join(backupDir, filename);

    if (!fs.existsSync(filepath)) {
      console.log(`❌ Backup file not found: ${filename}`);
      console.log('   Please export data before cleanup!');
      process.exit(1);
    }

    const stats = fs.statSync(filepath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`✅ ${filename} exists (${sizeInMB} MB)`);
  }

  // Confirm deletion
  if (!force) {
    console.log(`\n⚠️  WARNING: This will permanently delete transferlogs for years: ${yearsToDelete.join(', ')}`);
    console.log('   Backup files exist, but double-check before proceeding!');
    console.log('   Use --force flag to skip this confirmation');
    console.log('\n   Press Ctrl+C to cancel or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Delete data
  console.log('\n🗑️  Deleting archived transferlogs...');
  let totalDeleted = 0;

  for (const year of yearsToDelete) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const result = await collection.deleteMany({
      transferDate: { $gte: startDate, $lte: endDate }
    });

    totalDeleted += result.deletedCount || 0;
    console.log(`✅ Deleted ${result.deletedCount} records for year ${year}`);
  }

  console.log(`\n🎉 Cleanup completed - deleted ${totalDeleted} total records`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

