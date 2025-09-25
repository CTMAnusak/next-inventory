import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig, { 
  ICategoryConfig,
  IStatusConfig, 
  IConditionConfig,
  generateCategoryId,
  generateStatusId,
  generateConditionId,
  createDefaultCategoryConfig,
  createStatusConfig,
  createConditionConfig
} from '@/models/InventoryConfig';
import { verifyToken } from '@/lib/auth';

// GET - ดึงการตั้งค่าทั้งหมด
export async function GET() {
  try {
    await dbConnect();
    
    let config = await InventoryConfig.findOne({});
    
    if (!config) {
      // สร้าง config ใหม่ถ้าไม่มี
      config = new InventoryConfig({
        categoryConfigs: [],
        statusConfigs: [],
        conditionConfigs: []
      });
      await config.save();
    }
    
    // ตรวจสอบและเพิ่ม default configs ถ้าไม่มี
    let needsSave = false;
    
    // เพิ่ม default categories ถ้าไม่มี
    if (!config.categoryConfigs || config.categoryConfigs.length === 0) {
      config.categoryConfigs = [
        {
          id: 'cat_sim_card',
          name: 'ซิมการ์ด',
          isSystemCategory: true,
          order: 1, // Top priority (can be reordered)
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'cat_unassigned',
          name: 'ไม่ระบุ',
          isSystemCategory: true,
          order: 999, // Always at the bottom (cannot be reordered)
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ] as any;
      needsSave = true;
    }
    
    // เพิ่ม default statuses ถ้าไม่มี
    if (!config.statusConfigs || config.statusConfigs.length === 0) {
      config.statusConfigs = [
        {
          id: 'status_available',
          name: 'มี',
          color: '#10B981',
          order: 1,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'status_missing',
          name: 'หาย',
          color: '#EF4444',
          order: 2,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ] as any;
      needsSave = true;
    }
    
    // เพิ่ม default conditions ถ้าไม่มี
    if (!config.conditionConfigs || config.conditionConfigs.length === 0) {
      config.conditionConfigs = [
        {
          id: 'cond_working',
          name: 'ใช้งานได้',
          color: '#10B981',
          order: 1,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'cond_damaged',
          name: 'ชำรุด',
          color: '#F59E0B',
          order: 2,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ] as any;
      needsSave = true;
    }
    
    if (needsSave) {
      await config.save();
    }
    
    return NextResponse.json({
      categories: config.categoryConfigs.sort((a: ICategoryConfig, b: ICategoryConfig) => a.order - b.order),
      statuses: config.statusConfigs.sort((a: IStatusConfig, b: IStatusConfig) => a.order - b.order),
      conditions: config.conditionConfigs.sort((a: IConditionConfig, b: IConditionConfig) => a.order - b.order)
    });
    
  } catch (error) {
    console.error('Error fetching inventory config:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการตั้งค่า' },
      { status: 500 }
    );
  }
}

// POST - อัปเดตการตั้งค่าทั้งหมด
export async function POST(request: NextRequest) {
  try {
    // Verify admin token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }
    
    await dbConnect();
    
    const body = await request.json();
    const { categories, statuses, conditions } = body;
    
    // Validate input
    if (!Array.isArray(categories) || !Array.isArray(statuses) || !Array.isArray(conditions)) {
      return NextResponse.json(
        { error: 'ข้อมูลการตั้งค่าไม่ถูกต้อง' },
        { status: 400 }
      );
    }
    
    let config = await InventoryConfig.findOne({});
    
    if (!config) {
      config = new InventoryConfig({});
    }
    
    // Update categories
    config.categoryConfigs = categories.map((cat: any, index: number) => ({
      id: cat.id || generateCategoryId(),
      name: cat.name,
      isSystemCategory: cat.isSystemCategory || false,
      order: cat.order || index + 1,
      createdAt: cat.createdAt || new Date(),
      updatedAt: new Date()
    }));
    
    // Update statuses
    config.statusConfigs = statuses.map((status: any, index: number) => ({
      id: status.id || generateStatusId(),
      name: status.name,
      order: status.order || index + 1,
      isSystemConfig: status.isSystemConfig || false,
      createdAt: status.createdAt || new Date(),
      updatedAt: new Date()
    }));
    
    // Update conditions
    config.conditionConfigs = conditions.map((condition: any, index: number) => ({
      id: condition.id || generateConditionId(),
      name: condition.name,
      order: condition.order || index + 1,
      isSystemConfig: condition.isSystemConfig || false,
      createdAt: condition.createdAt || new Date(),
      updatedAt: new Date()
    }));
    
    await config.save();
    
    return NextResponse.json({
      message: 'อัปเดตการตั้งค่าเรียบร้อยแล้ว',
      categories: config.categoryConfigs,
      statuses: config.statusConfigs,
      conditions: config.conditionConfigs
    });
    
  } catch (error) {
    console.error('Error updating inventory config:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปเดตการตั้งค่า' },
      { status: 500 }
    );
  }
}
