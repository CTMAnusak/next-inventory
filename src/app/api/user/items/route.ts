import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import ReturnLog from '@/models/ReturnLog';
import Inventory from '@/models/Inventory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const firstName = searchParams.get('firstName') || '';
    const lastName = searchParams.get('lastName') || '';
    const office = searchParams.get('office') || '';

    if (!firstName || !lastName || !office) {
      return NextResponse.json({ items: [] });
    }

    await dbConnect();

    // Aggregate requested quantities by itemName
    const requestLogs = await RequestLog.find({ firstName, lastName, office });
    const requestedByName: Record<string, number> = {};
    for (const log of requestLogs) {
      for (const item of log.items || []) {
        const name = item.itemName;
        const qty = Number(item.quantity || 0);
        requestedByName[name] = (requestedByName[name] || 0) + qty;
      }
    }

    // Aggregate returned quantities by itemName
    const returnLogs = await ReturnLog.find({ firstName, lastName, office });
    const returnedByName: Record<string, number> = {};
    for (const log of returnLogs) {
      for (const item of (log.items as any[]) || []) {
        const name = item.itemName;
        const qty = Number(item.quantity || 0);
        returnedByName[name] = (returnedByName[name] || 0) + qty;
      }
    }

    // Compute owned (outstanding) items by name
    const ownedNames = new Set<string>();
    for (const name of Object.keys(requestedByName)) {
      const outstanding = (requestedByName[name] || 0) - (returnedByName[name] || 0);
      if (outstanding > 0) ownedNames.add(name);
    }

    // Also include explicitly added owned items from Inventory (user-added items)
    const manualOwned = await Inventory.find({ 
      'addedBy.role': 'user',
      // Try to match by user info - this is a fallback for legacy data
      $or: [
        { userId: { $exists: true } }, // If we have userId, use any user-added items
        // Fallback: no good way to match without userId, so skip for now
      ]
    });
    for (const row of manualOwned) {
      ownedNames.add(row.itemName);
    }

    return NextResponse.json({ items: Array.from(ownedNames) });
  } catch (error) {
    console.error('Fetch user items error:', error);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}


