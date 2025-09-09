import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import InventoryMaster from '@/models/InventoryMaster';
import InventoryItem from '@/models/InventoryItem';
import { verifyTokenFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    await dbConnect();

    console.log('🔧 Starting ReturnLog ID mismatch fix...');

    // Find all pending return logs
    const returnLogs = await ReturnLog.find({ status: 'pending' });
    
    console.log(`📋 Found ${returnLogs.length} pending return logs`);

    const fixResults = [];

    for (const returnLog of returnLogs) {
      console.log(`\n🔍 Processing ReturnLog: ${returnLog._id}`);
      console.log(`👤 User: ${returnLog.firstName} ${returnLog.lastName} (${returnLog.userId})`);

      let returnLogModified = false;

      for (let i = 0; i < returnLog.items.length; i++) {
        const item = returnLog.items[i];
        console.log(`\n  📦 Item ${i}: ${item.itemId} (SN: ${item.serialNumber})`);

        // Check if itemId points to InventoryMaster instead of InventoryItem
        const inventoryMaster = await InventoryMaster.findById(item.itemId);
        const inventoryItem = await InventoryItem.findById(item.itemId);

        if (inventoryMaster && !inventoryItem) {
          console.log(`  ⚠️  ID MISMATCH: Points to InventoryMaster, finding correct InventoryItem...`);

          // Find the actual InventoryItem that user owns
          const userInventoryItems = await InventoryItem.find({
            itemName: inventoryMaster.itemName,
            serialNumber: item.serialNumber,
            'currentOwnership.ownerType': 'user_owned',
            'currentOwnership.userId': returnLog.userId
          });

          if (userInventoryItems.length > 0) {
            const correctItem = userInventoryItems[0];
            console.log(`  ✅ Found correct InventoryItem: ${correctItem._id}`);

            // Update the itemId in ReturnLog
            returnLog.items[i].itemId = correctItem._id.toString();
            returnLog.items[i].itemName = correctItem.itemName;
            
            returnLogModified = true;

            fixResults.push({
              returnLogId: returnLog._id,
              itemIndex: i,
              oldItemId: item.itemId,
              newItemId: correctItem._id.toString(),
              itemName: correctItem.itemName,
              serialNumber: item.serialNumber,
              status: 'fixed'
            });

            console.log(`  📝 Updated itemId: ${item.itemId} → ${correctItem._id}`);
          } else {
            console.log(`  ❌ No matching InventoryItem found for user`);
            
            fixResults.push({
              returnLogId: returnLog._id,
              itemIndex: i,
              oldItemId: item.itemId,
              newItemId: null,
              itemName: inventoryMaster.itemName,
              serialNumber: item.serialNumber,
              status: 'not_found'
            });
          }
        } else if (inventoryItem) {
          console.log(`  ✅ Already points to InventoryItem (correct)`);
          
          fixResults.push({
            returnLogId: returnLog._id,
            itemIndex: i,
            oldItemId: item.itemId,
            newItemId: item.itemId,
            itemName: inventoryItem.itemName,
            serialNumber: item.serialNumber,
            status: 'already_correct'
          });
        } else {
          console.log(`  ❌ Invalid itemId - points to nothing`);
          
          fixResults.push({
            returnLogId: returnLog._id,
            itemIndex: i,
            oldItemId: item.itemId,
            newItemId: null,
            itemName: 'Unknown',
            serialNumber: item.serialNumber,
            status: 'invalid'
          });
        }
      }

      // Save the modified ReturnLog
      if (returnLogModified) {
        await returnLog.save();
        console.log(`  💾 ReturnLog ${returnLog._id} updated successfully`);
      }
    }

    const summary = {
      totalReturnLogs: returnLogs.length,
      totalItems: fixResults.length,
      fixed: fixResults.filter(r => r.status === 'fixed').length,
      alreadyCorrect: fixResults.filter(r => r.status === 'already_correct').length,
      notFound: fixResults.filter(r => r.status === 'not_found').length,
      invalid: fixResults.filter(r => r.status === 'invalid').length
    };

    console.log(`\n📊 Fix Summary:`, summary);

    return NextResponse.json({
      message: 'ReturnLog ID mismatch fix completed',
      summary,
      details: fixResults
    });

  } catch (error) {
    console.error('Fix ReturnLog ID mismatch error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการแก้ไข' },
      { status: 500 }
    );
  }
}
