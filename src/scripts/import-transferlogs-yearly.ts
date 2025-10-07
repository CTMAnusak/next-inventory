import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Import transferlogs from yearly JSON files back to database
// Usage: npx tsx src/scripts/import-transferlogs-yearly.ts --year=2024
// Or: npx tsx src/scripts/import-transferlogs-yearly.ts --all

async function run() {
  await dbConnect();

  const args = process.argv.slice(2);
  const yearFlag = args.find(arg => arg.startsWith('--year='));
  const year = yearFlag ? parseInt(yearFlag.split('=')[1]) : null;
  const allYears = args.includes('--all');
  const targetFlag = args.find(arg => arg.startsWith('--target='));
  const targetCollection = targetFlag ? targetFlag.split('=')[1] : 'transferlogs_archive';

  if (!year && !allYears) {
    console.log('❌ Please specify --year=YYYY or --all');
    process.exit(1);
  }

  const backupDir = path.join(process.cwd(), 'backup_migration', 'transferlogs');

  if (!fs.existsSync(backupDir)) {
    console.log('❌ Backup directory not found:', backupDir);
    process.exit(1);
  }

  let filesToImport: string[] = [];

  if (allYears) {
    // Find all transferlogs_*.json files
    const files = fs.readdirSync(backupDir);
    filesToImport = files.filter(f => f.match(/^transferlogs_\d{4}\.json$/));
  } else if (year) {
    const filename = `transferlogs_${year}.json`;
    if (fs.existsSync(path.join(backupDir, filename))) {
      filesToImport = [filename];
    } else {
      console.log(`❌ File not found: ${filename}`);
      process.exit(1);
    }
  }

  if (filesToImport.length === 0) {
    console.log('❌ No files to import');
    process.exit(1);
  }

  const collection = mongoose.connection.collection(targetCollection);

  for (const filename of filesToImport) {
    await importFile(path.join(backupDir, filename), collection);
  }

  console.log('🎉 Import completed');
  process.exit(0);
}

async function importFile(filepath: string, collection: any) {
  console.log(`\n📥 Importing from ${path.basename(filepath)}...`);

  const fileContent = fs.readFileSync(filepath, 'utf-8');
  const exportData = JSON.parse(fileContent);

  if (!exportData.data || !Array.isArray(exportData.data)) {
    console.log('❌ Invalid file format');
    return;
  }

  console.log(`   Year: ${exportData.year}, Records: ${exportData.totalRecords}`);

  // Insert in batches to avoid memory issues
  const batchSize = 1000;
  let imported = 0;

  for (let i = 0; i < exportData.data.length; i += batchSize) {
    const batch = exportData.data.slice(i, i + batchSize);
    try {
      await collection.insertMany(batch, { ordered: false });
      imported += batch.length;
    } catch (err: any) {
      // Handle duplicate key errors (already imported)
      if (err.code === 11000) {
        const duplicates = err.writeErrors?.length || 0;
        imported += batch.length - duplicates;
        console.log(`   ⚠️  Skipped ${duplicates} duplicates`);
      } else {
        throw err;
      }
    }
  }

  console.log(`✅ Imported ${imported} records`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

