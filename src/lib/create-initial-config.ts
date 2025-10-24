import dbConnect from '@/lib/mongodb';
import InventoryConfig from '@/models/InventoryConfig';

/**
 * สร้างข้อมูล InventoryConfig เริ่มต้น
 */
export async function createInitialInventoryConfig() {
  try {
    await dbConnect();
    
    // ตรวจสอบว่ามีข้อมูลอยู่แล้วหรือไม่
    const existingConfig = await InventoryConfig.findOne();
    if (existingConfig) {
      console.log('✅ InventoryConfig already exists');
      return existingConfig;
    }
    
    // สร้างข้อมูลเริ่มต้น
    const initialConfig = new InventoryConfig({
      categoryConfigs: [
        {
          id: 'cat_default',
          name: 'ไม่ระบุ',
          isSystemCategory: true,
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      statusConfigs: [
        {
          id: 'status_available',
          name: 'มี',
          order: 0,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'status_missing',
          name: 'หาย',
          order: 1,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      conditionConfigs: [
        {
          id: 'cond_working',
          name: 'ใช้งานได้',
          order: 0,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'cond_broken',
          name: 'ชำรุด',
          order: 1,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    });
    
    await initialConfig.save();
    console.log('✅ Initial InventoryConfig created successfully');
    return initialConfig;
    
  } catch (error) {
    console.error('❌ Error creating initial InventoryConfig:', error);
    throw error;
  }
}
