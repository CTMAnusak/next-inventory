import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import { clearAllCaches } from '@/lib/cache-utils';

// PATCH - Manage Serial Numbers (Disabled for new inventory system)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    { 
      error: 'This endpoint is deprecated. Please use the new inventory system.',
      message: 'Serial number management is now handled through individual InventoryItem records.'
    },
    { status: 410 }
  );
}

// DELETE - Remove inventory item (Disabled for new inventory system)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    { 
      error: 'This endpoint is deprecated. Please use the new inventory system.',
      message: 'Item deletion is now handled through individual InventoryItem records.'
    },
    { status: 410 }
  );
}