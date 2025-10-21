/**
 * 🔧 API บังคับ update statusConfigs โดยตรง - สำหรับ debug
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig from '@/models/InventoryConfig';

export async function POST(request: NextRequest) {
  try {
    
    await dbConnect();
    
    const body = await request.json();
    
    // หา config document
    const config = await InventoryConfig.findOne();
    if (!config) {
      return NextResponse.json({ error: 'No config found' }, { status: 404 });
    }
    
    
    // อัปเดต statusConfigs โดยตรง
    const newStatusConfigs = [
      {
        id: "status_1758288865207_wik26uxog",
        name: "ใช้งานได้",
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "status_test_12345", 
        name: "ใช้งานดี",
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    
    // ใช้ MongoDB collection โดยตรง
    const result = await InventoryConfig.collection.updateOne(
      { _id: config._id },
      { 
        $set: { 
          statusConfigs: newStatusConfigs 
        } 
      }
    );
    
    
    // ตรวจสอบหลัง update
    const updatedConfig = await InventoryConfig.findOne().lean() as any;
    
    return NextResponse.json({
      success: true,
      message: 'Force update statusConfigs success',
      modifiedCount: result.modifiedCount,
      statusConfigsLength: updatedConfig?.statusConfigs?.length || 0,
      statusConfigs: updatedConfig?.statusConfigs || []
    });

  } catch (error) {
    console.error('❌ Force update error:', error);
    return NextResponse.json({ 
      error: 'Force update failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
