import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';

// Archives transferlogs older than cutoffDays into transferlogs_archive and deletes them from main collection
// Safe to run daily via cron. Idempotent by using _id list.

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get('days') || 365);

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const mainCol = mongoose.connection.collection('transferlogs');
    const archiveCol = mongoose.connection.collection('transferlogs_archive');

    // Read batch of old logs excluding keepForever
    const oldDocs = await mainCol
      .find({ transferDate: { $lt: cutoff }, keepForever: { $ne: true } })
      .project({})
      .limit(10000)
      .toArray();

    if (oldDocs.length === 0) {
      return NextResponse.json({ archived: 0, message: 'nothing to archive' });
    }

    await archiveCol.insertMany(oldDocs, { ordered: false });
    await mainCol.deleteMany({ _id: { $in: oldDocs.map((d) => d._id) } });

    return NextResponse.json({ archived: oldDocs.length });
  } catch (error) {
    console.error('archive-transferlogs error', error);
    return NextResponse.json({ error: 'archive failed' }, { status: 500 });
  }
}


