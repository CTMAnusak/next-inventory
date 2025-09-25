import mongoose, { Document, Schema } from 'mongoose';

export interface IReturnItem {
  itemId: string;       // Primary reference to inventory item (legacy)
  inventoryItemId?: string; // Reference to InventoryItem._id (new system)
  quantity: number;
  itemName?: string;    // Item name when returned
  category?: string;    // Category when returned
  masterItemId?: string; // Reference to InventoryMaster._id for consistency
  serialNumber?: string; // Serial Number (ถ้ามี)
  numberPhone?: string; // Phone Number (สำหรับซิมการ์ด)
  assetNumber?: string; // เลขทรัพย์สิน
  image?: string; // รูปภาพ
  condition?: 'good' | 'damaged' | 'needs_repair'; // สภาพของที่คืน (legacy)
  statusOnReturn?: string; // สภาพเมื่อคืน (มี/หาย) - ระบบใหม่
  conditionOnReturn?: string; // สถานะเมื่อคืน (ใช้งานได้/ชำรุด) - ระบบใหม่
}

export interface IReturnLog extends Document {
  firstName: string;
  lastName: string;
  nickname: string;
  department: string;
  office: string; // สาขา/ออฟฟิศ
  email?: string;
  phoneNumber?: string;
  returnDate: Date; // วันที่คืน
  items: IReturnItem[]; // รายการอุปกรณ์ที่คืน
  status: 'completed' | 'pending'; // สถานะการคืน
  userId?: string; // ผู้ใช้ที่สร้างรายการ (อ้างอิง users._id)
  
  // Fields สำหรับการคืนอัตโนมัติ
  isAutoReturn?: boolean; // flag สำหรับการคืนอัตโนมัติ
  autoReturnReason?: string; // เหตุผลการคืนอัตโนมัติ
  submittedAt?: Date; // วันที่สร้างรายการ
  notes?: string; // หมายเหตุเพิ่มเติม
  
  createdAt: Date;
  updatedAt: Date;
}

const ReturnItemSchema = new Schema<IReturnItem>({
  itemId: { type: String, required: true },         // Primary reference to inventory (legacy)
  inventoryItemId: { type: String },                // Reference to InventoryItem._id (new system)
  quantity: { type: Number, required: true, min: 1 },
  itemName: { type: String },                       // Item name when returned
  category: { type: String },                       // Category when returned
  masterItemId: { type: String },                   // Reference to InventoryMaster._id
  serialNumber: { type: String },                   // Serial Number
  numberPhone: { type: String },                    // Phone Number (สำหรับซิมการ์ด)
  assetNumber: { type: String },
  image: { type: String },                          // path ของรูปภาพ
  condition: {                                      // Legacy field
    type: String, 
    enum: ['good', 'damaged', 'needs_repair'],
    default: 'good'
  },
  statusOnReturn: { type: String },                 // สภาพเมื่อคืน (มี/หาย) - ระบบใหม่
  conditionOnReturn: { type: String }               // สถานะเมื่อคืน (ใช้งานได้/ชำรุด) - ระบบใหม่
});

const ReturnLogSchema = new Schema<IReturnLog>({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  nickname: { type: String, required: true },
  department: { type: String, required: true },
  office: { type: String, required: true },
  email: { type: String },
  phoneNumber: { type: String },
  returnDate: { type: Date, required: true },
  items: [ReturnItemSchema],
  status: { 
    type: String, 
    enum: ['completed', 'pending'], 
    default: 'pending'
  },
  userId: { type: String },
  
  // Fields สำหรับการคืนอัตโนมัติ
  isAutoReturn: { type: Boolean, default: false },
  autoReturnReason: { type: String },
  submittedAt: { type: Date },
  notes: { type: String }
}, {
  timestamps: true
});

export default mongoose.models.ReturnLog || mongoose.model<IReturnLog>('ReturnLog', ReturnLogSchema);
