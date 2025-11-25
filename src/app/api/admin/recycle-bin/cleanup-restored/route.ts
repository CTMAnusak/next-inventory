import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';

// POST - Clean up restored items from recycle bin
export async function POST(request: NextRequest) {
    let client: MongoClient | null = null;

    try {
        await dbConnect();

        // Get user info from token
        const token = request.cookies.get('auth-token')?.value;
        const payload: any = token ? verifyToken(token) : null;

        if (!payload) {
            return NextResponse.json(
                { error: 'กรุณาเข้าสู่ระบบ' },
                { status: 401 }
            );
        }

        // Check if user is admin or super_admin
        const currentUser = await User.findOne({ user_id: payload.userId });
        if (!currentUser || !['admin', 'it_admin', 'super_admin'].includes(currentUser.userRole)) {
            return NextResponse.json(
                { error: 'คุณไม่มีสิทธิ์ทำการนี้' },
                { status: 403 }
            );
        }

        // Use direct MongoDB to clean up
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MONGODB_URI is not defined');
        }

        client = new MongoClient(uri);
        await client.connect();
        const db = client.db();
        const recycleBin = db.collection('recyclebins');

        // Find all items that are marked as restored
        const restoredItems = await recycleBin.find({
            isRestored: true
        }).toArray();

        if (restoredItems.length === 0) {
            await client.close();
            return NextResponse.json({
                success: true,
                message: 'ไม่มีรายการที่ต้องทำความสะอาด',
                deletedCount: 0
            });
        }

        // Delete all restored items
        const result = await recycleBin.deleteMany({
            isRestored: true
        });

        await client.close();
        client = null;

        return NextResponse.json({
            success: true,
            message: `ลบรายการที่กู้คืนแล้วออกจากถังขยะเรียบร้อย ${result.deletedCount} รายการ`,
            deletedCount: result.deletedCount,
            items: restoredItems.map(item => ({
                itemName: item.itemName,
                serialNumber: item.serialNumber,
                restoredAt: item.restoredAt
            }))
        });

    } catch (error) {
        console.error('❌ Cleanup API - Error:', error);

        // Ensure client is closed even on error
        if (client) {
            try {
                await client.close();
            } catch (closeError) {
                console.error('Error closing MongoDB client:', closeError);
            }
        }

        return NextResponse.json(
            { error: 'เกิดข้อผิดพลาดในการทำความสะอาด' },
            { status: 500 }
        );
    }
}
