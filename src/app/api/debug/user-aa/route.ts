import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import InventoryItem from '@/models/InventoryItem';
import User from '@/models/User';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const db = mongoose.connection.db;
    
    // Check all collections
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
    // Check InventoryItems collection for user AA
    const inventoryItems = await db.collection('inventoryitems').find({
      'currentOwnership.ownerType': 'user_owned',
      'currentOwnership.userId': 'AA',
      deletedAt: { $exists: false }
    }).toArray();
    
    // Check InventoryItems collection (with capital I)
    const inventoryItemsCapital = await db.collection('InventoryItems').find({
      'currentOwnership.ownerType': 'user_owned',
      'currentOwnership.userId': 'AA',
      deletedAt: { $exists: false }
    }).toArray();
    
    // Check all user-owned items in both collections
    const allUserOwned = await db.collection('inventoryitems').find({
      'currentOwnership.ownerType': 'user_owned',
      deletedAt: { $exists: false }
    }).toArray();
    
    const allUserOwnedCapital = await db.collection('InventoryItems').find({
      'currentOwnership.ownerType': 'user_owned',
      deletedAt: { $exists: false }
    }).toArray();
    
    // Check users collection
    const userAA = await db.collection('users').find({ user_id: 'AA' }).toArray();
    
    // Check all users with 'AA' in their name
    const usersWithAA = await db.collection('users').find({
      $or: [
        { firstName: { $regex: 'AA', $options: 'i' } },
        { lastName: { $regex: 'AA', $options: 'i' } },
        { nickname: { $regex: 'AA', $options: 'i' } }
      ]
    }).toArray();
    
    return NextResponse.json({
      collections: collections.map(c => c.name),
      userAAItems: {
        inventoryitems: inventoryItems.length,
        InventoryItems: inventoryItemsCapital.length
      },
      allUserOwned: {
        inventoryitems: allUserOwned.length,
        InventoryItems: allUserOwnedCapital.length
      },
      userAA: userAA.length,
      usersWithAA: usersWithAA.length,
      userAADetails: userAA,
      usersWithAADetails: usersWithAA,
      allUserOwnedDetails: {
        inventoryitems: allUserOwned,
        InventoryItems: allUserOwnedCapital
      }
    });
    
  } catch (error: any) {
    console.error('Error debugging user AA:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล', details: error.message },
      { status: 500 }
    );
  }
}
