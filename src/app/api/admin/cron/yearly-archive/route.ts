import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

/**
 * API Endpoint for Yearly Archive & Cleanup
 * รันอัตโนมัติผ่าน Vercel Cron ทุกวันที่ 1 มกราคม เวลา 02:00
 * 
 * สิ่งที่ทำ:
 * 1. ตรวจสอบว่าเป็นวันที่ 1 มกราคมหรือไม่
 * 2. Export ข้อมูลปีที่แล้วไปไฟล์ JSON
 * 3. ย้ายข้อมูลปีที่แล้วไป transferlogs_archive
 * 4. ลบข้อมูลปีที่แล้วออกจาก transferlogs
 */

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const today = new Date();
    const isJanuary1st = today.getDate() === 1 && today.getMonth() === 0;

    // ตรวจสอบว่าเป็นวันที่ 1 มกราคมหรือไม่
    if (!isJanuary1st) {
      return NextResponse.json({
        success: false,
        message: 'Not January 1st - skipping archive',
        currentDate: today.toISOString()
      });
    }

    const yearToProcess = today.getFullYear() - 1;
    const startDate = new Date(yearToProcess, 0, 1, 0, 0, 0);
    const endDate = new Date(yearToProcess, 11, 31, 23, 59, 59);

    console.log(`📅 Yearly Archive Cron - Processing year ${yearToProcess}`);

    const mainCollection = mongoose.connection.collection('transferlogs');
    const archiveCollection = mongoose.connection.collection('transferlogs_archive');

    // Count documents
    const count = await mainCollection.countDocuments({
      transferDate: { $gte: startDate, $lte: endDate }
    });

    if (count === 0) {
      return NextResponse.json({
        success: true,
        message: `No data found for year ${yearToProcess}`,
        year: yearToProcess,
        recordsProcessed: 0
      });
    }

    console.log(`📊 Found ${count} records to process`);

    // Step 1: Export to JSON file
    const exportResult = await exportToFile(mainCollection, yearToProcess, startDate, endDate);

    // Step 2: Move to archive collection
    const archiveResult = await moveToArchive(mainCollection, archiveCollection, startDate, endDate);

    // Step 3: Delete from main collection
    const deleteResult = await deleteFromMain(mainCollection, startDate, endDate);

    console.log(`🎉 Yearly archive completed for year ${yearToProcess}`);

    return NextResponse.json({
      success: true,
      message: `Successfully archived year ${yearToProcess}`,
      year: yearToProcess,
      recordsProcessed: count,
      details: {
        exported: exportResult,
        archived: archiveResult,
        deleted: deleteResult
      }
    });

  } catch (error) {
    console.error('❌ Yearly archive error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
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
  console.log(`✅ Exported ${docs.length} records to ${filename} (${sizeInMB} MB)`);

  return {
    filename,
    records: docs.length,
    sizeInMB: parseFloat(sizeInMB)
  };
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

  if (docs.length === 0) {
    return { moved: 0, skipped: 0 };
  }

  let moved = docs.length;
  let skipped = 0;

  try {
    await archiveCollection.insertMany(docs, { ordered: false });
    console.log(`✅ Moved ${moved} records to transferlogs_archive`);
  } catch (err: any) {
    if (err.code === 11000) {
      moved = docs.length - (err.writeErrors?.length || 0);
      skipped = err.writeErrors?.length || 0;
      console.log(`✅ Moved ${moved} records (skipped ${skipped} duplicates)`);
    } else {
      throw err;
    }
  }

  return { moved, skipped };
}

async function deleteFromMain(
  mainCollection: any,
  startDate: Date,
  endDate: Date
) {
  const result = await mainCollection.deleteMany({
    transferDate: { $gte: startDate, $lte: endDate }
  });

  const deleted = result.deletedCount || 0;
  console.log(`✅ Deleted ${deleted} records from transferlogs`);

  return { deleted };
}

