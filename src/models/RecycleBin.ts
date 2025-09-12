import mongoose, { Document, Schema } from 'mongoose';

export interface IRecycleBin extends Document {
  // ข้อมูลอุปกรณ์ที่ถูกลบ
  itemName: string;
  category: string;
  serialNumber?: string;        // SN ของอุปกรณ์ (ถ้ามี)
  numberPhone?: string;         // เบอร์โทรศัพท์ (สำหรับซิมการ์ด)
  
  // ข้อมูลการลบ
  deleteType: 'individual_item' | 'category_bulk';  // ประเภทการลบ
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
    enum: ['individual_item', 'category_bulk'],
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
RecycleBinSchema.index({ itemName: 1, category: 1, deleteType: 1 }); // สำหรับ UI listing

// Pre-save middleware: คำนวณ permanentDeleteAt
RecycleBinSchema.pre('save', function(next) {
  if (this.isNew && !this.permanentDeleteAt) {
    // กำหนดให้ลบถาวรหลัง 30 วัน
    const deleteDate = this.deletedAt || new Date();
    this.permanentDeleteAt = new Date(deleteDate.getTime() + (30 * 24 * 60 * 60 * 1000));
  }
  next();
});

// Static methods สำหรับ common operations
RecycleBinSchema.statics.findBySerialNumber = function(serialNumber: string) {
  return this.findOne({ 
    serialNumber: serialNumber
  });
};

RecycleBinSchema.statics.findDeletedItems = function(page: number = 1, limit: number = 50) {
  const skip = (page - 1) * limit;
  return this.find({ 
    deleteType: 'individual_item'
  })
  .sort({ deletedAt: -1 })
  .skip(skip)
  .limit(limit);
};

RecycleBinSchema.statics.findDeletedCategories = function(page: number = 1, limit: number = 50) {
  const skip = (page - 1) * limit;
  return this.find({ 
    deleteType: 'category_bulk'
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
