import mongoose, { Document, Schema } from 'mongoose';

export interface IRecycleBin extends Document {
  // ข้อมูลอุปกรณ์ที่ถูกลบ
  itemName: string;
  category: string;
  categoryId: string;               // เพิ่มเพื่อความชัดเจน
  inventoryMasterId: string;        // 🆕 ID ของ InventoryMaster สำหรับจัดกลุ่ม
  serialNumber?: string;            // SN ของอุปกรณ์ (ถ้ามี)
  numberPhone?: string;             // เบอร์โทรศัพท์ (สำหรับซิมการ์ด)
  
  // ข้อมูลการลบ
  deleteType: 'individual_item' | 'bulk_delete';    // เปลี่ยนชื่อให้ชัดเจน
  deletedAt: Date;                                  // วันที่ลบ
  deleteReason: string;                             // เหตุผลการลบ
  deletedBy: string;                                // ผู้ลบ (user_id)
  deletedByName: string;                            // ชื่อผู้ลบ
  
  // ข้อมูลเดิมก่อนถูกลบ (เก็บเป็น JSON object)
  originalData: any;
  
  // ข้อมูลการลบถาวร
  permanentDeleteAt: Date;                          // วันที่จะถูกลบถาวร (30 วันหลัง deletedAt)
  isRestored: boolean;                              // ถูกกู้คืนแล้วหรือไม่
  restoredAt?: Date;                                // วันที่กู้คืน
  restoredBy?: string;                              // ผู้กู้คืน (user_id)
  restoredByName?: string;                          // ชื่อผู้กู้คืน
  
  createdAt: Date;
  updatedAt: Date;
}

const RecycleBinSchema = new Schema<IRecycleBin>({
  itemName: { 
    type: String, 
    required: true,
    index: true
  },
  category: { 
    type: String, 
    required: true,
    index: true
  },
  categoryId: {
    type: String,
    required: true,
    index: true
  },
  inventoryMasterId: {
    type: String,
    required: true,
    index: true  // 🆕 สำหรับจัดกลุ่มและค้นหา
  },
  serialNumber: { 
    type: String,
    sparse: true,
    index: true  // สำหรับค้นหา SN ในถังขยะ
  },
  numberPhone: {
    type: String,
    sparse: true,
    index: true  // สำหรับค้นหาเบอร์โทรศัพท์ในถังขยะ
  },
  
  deleteType: {
    type: String,
    enum: ['individual_item', 'bulk_delete'],  // เปลี่ยนชื่อ
    required: true,
    index: true
  },
  deletedAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  deleteReason: {
    type: String,
    required: true
  },
  deletedBy: {
    type: String,
    required: true,
    index: true
  },
  deletedByName: {
    type: String,
    required: true
  },
  
  originalData: {
    type: Schema.Types.Mixed,
    required: true
  },
  
  permanentDeleteAt: {
    type: Date,
    required: true,
    index: true  // สำหรับ auto-cleanup
  },
  isRestored: {
    type: Boolean,
    default: false,
    index: true
  },
  restoredAt: Date,
  restoredBy: String,
  restoredByName: String
}, {
  timestamps: true
});

// Indexes สำหรับ performance
RecycleBinSchema.index({ serialNumber: 1, isRestored: 1 }); // สำหรับตรวจสอบ SN ซ้ำ
RecycleBinSchema.index({ numberPhone: 1, isRestored: 1 }); // สำหรับตรวจสอบเบอร์โทรศัพท์ซ้ำ
RecycleBinSchema.index({ deletedAt: 1, isRestored: 1 });    // สำหรับ auto-cleanup
RecycleBinSchema.index({ inventoryMasterId: 1, isRestored: 1 }); // 🆕 สำหรับจัดกลุ่ม
RecycleBinSchema.index({ itemName: 1, categoryId: 1, deleteType: 1 }); // สำหรับ UI listing

// Pre-save middleware: คำนวณ permanentDeleteAt
RecycleBinSchema.pre('save', function(next) {
  if (this.isNew && !this.permanentDeleteAt) {
    // 🕐 ระบบนับวัน: เริ่มนับที่ 18:00 น. ของวันที่ลบ
    // ตัวอย่าง: ลบ 15 ม.ค. 12:00 → เริ่มนับ 15 ม.ค. 18:00 → วันที่ 16 ม.ค. 18:00 = วันที่ 1
    const deleteDate = this.deletedAt || new Date();
    
    // หาเวลา 18:00 ของวันที่ลบ
    const startCountDate = new Date(deleteDate);
    startCountDate.setHours(18, 0, 0, 0); // ตั้งเป็น 18:00:00.000
    
    // ถ้าลบก่อน 18:00 → เริ่มนับวันนี้ 18:00
    // ถ้าลบหลัง 18:00 → เริ่มนับพรุ่งนี้ 18:00
    if (deleteDate.getHours() >= 18 || 
        (deleteDate.getHours() === 18 && deleteDate.getMinutes() > 0)) {
      // ลบหลัง 18:00 แล้ว → เริ่มนับพรุ่งนี้ 18:00
      startCountDate.setDate(startCountDate.getDate() + 1);
    }
    
    // บวก 30 วันจากวันที่เริ่มนับ
    this.permanentDeleteAt = new Date(startCountDate.getTime() + (30 * 24 * 60 * 60 * 1000));
  }
  next();
});

// Static methods สำหรับ common operations
RecycleBinSchema.statics.findBySerialNumber = function(serialNumber: string) {
  return this.findOne({ 
    serialNumber: serialNumber
  });
};

// 🆕 ใหม่: จัดกลุ่มตาม inventoryMasterId
RecycleBinSchema.statics.findGroupedDeletedItems = function(page: number = 1, limit: number = 50) {
  const skip = (page - 1) * limit;
  
  return this.aggregate([
    {
      $match: {
        isRestored: { $ne: true }
      }
    },
    {
      $group: {
        _id: '$inventoryMasterId',
        itemName: { $first: '$itemName' },
        category: { $first: '$category' },
        categoryId: { $first: '$categoryId' },
        deleteType: { $first: '$deleteType' },
        deletedAt: { $first: '$deletedAt' },
        deleteReason: { $first: '$deleteReason' },
        deletedBy: { $first: '$deletedBy' },
        deletedByName: { $first: '$deletedByName' },
        permanentDeleteAt: { $first: '$permanentDeleteAt' },
        totalItems: { $sum: 1 },
        items: {
          $push: {
            _id: '$_id',
            serialNumber: '$serialNumber',
            numberPhone: '$numberPhone',
            originalData: '$originalData'
          }
        }
      }
    },
    {
      $sort: { deletedAt: -1 }
    },
    {
      $skip: skip
    },
    {
      $limit: limit
    }
  ]);
};

// เก็บไว้สำหรับ backward compatibility
RecycleBinSchema.statics.findDeletedItems = function(page: number = 1, limit: number = 50) {
  const skip = (page - 1) * limit;
  return this.find({ 
    deleteType: 'individual_item',
    isRestored: { $ne: true }
  })
  .sort({ deletedAt: -1 })
  .skip(skip)
  .limit(limit);
};

RecycleBinSchema.statics.findDeletedCategories = function(page: number = 1, limit: number = 50) {
  const skip = (page - 1) * limit;
  return this.find({ 
    deleteType: 'bulk_delete',
    isRestored: { $ne: true }
  })
  .sort({ deletedAt: -1 })
  .skip(skip)
  .limit(limit);
};

RecycleBinSchema.statics.findExpiredItems = function() {
  return this.find({
    permanentDeleteAt: { $lte: new Date() }
  });
};

// Force recreation of model to ensure schema updates
if (mongoose.models.RecycleBin) {
  delete mongoose.models.RecycleBin;
}

export default mongoose.model<IRecycleBin>('RecycleBin', RecycleBinSchema);
