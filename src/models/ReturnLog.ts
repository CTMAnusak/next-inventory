import mongoose, { Document, Schema } from 'mongoose';

export interface IReturnItem {
  itemId: string;       // Reference to specific InventoryItem._id being returned
  itemName?: string;    // 🆕 Snapshot: ชื่ออุปกรณ์ (เก็บไว้เมื่อ InventoryItem ถูกลบ)
  category?: string;    // 🆕 Snapshot: ชื่อหมวดหมู่ (เก็บไว้เมื่อ InventoryItem ถูกลบ)
  categoryId?: string;  // 🆕 Snapshot: ID หมวดหมู่ (เก็บไว้เมื่อ InventoryItem ถูกลบ)
  quantity: number;
  serialNumber?: string; // 🆕 Snapshot: Serial Number (ถ้ามี)
  numberPhone?: string; // 🆕 Snapshot: Phone Number (สำหรับซิมการ์ด)
  assetNumber?: string; // เลขทรัพย์สิน
  image?: string; // รูปภาพ
  statusOnReturn?: string; // สถานะอุปกรณ์เมื่อคืน (มี/หาย/ชำรุด - จาก status config)
  conditionOnReturn?: string; // สภาพอุปกรณ์เมื่อคืน (ใช้งานได้/ชำรุด - จาก condition config)
  statusOnReturnName?: string; // 🆕 Snapshot: ชื่อสถานะ (สภาพอุปกรณ์)
  conditionOnReturnName?: string; // 🆕 Snapshot: ชื่อสภาพ (สถานะอุปกรณ์)
  itemNotes?: string; // หมายเหตุเฉพาะรายการ
  approvalStatus: 'pending' | 'approved'; // สถานะการอนุมัติของรายการนี้
  approvedAt?: Date; // วันที่อนุมัติ
  approvedBy?: string; // Admin userId ที่อนุมัติ
  approvedByName?: string; // 🆕 Snapshot: ชื่อ Admin ผู้อนุมัติ
}

export interface IReturnLog extends Document {
  // User info - store only userId for real-time lookup
  userId: string; // Reference to User._id for real-time lookup
  // Store user info for branch users (who don't have user profiles)
  returnerFirstName?: string; // ชื่อผู้คืนอุปกรณ์ (สำหรับผู้ใช้ประเภทสาขา)
  returnerLastName?: string; // นามสกุลผู้คืนอุปกรณ์ (สำหรับผู้ใช้ประเภทสาขา)
  returnerNickname?: string; // ชื่อเล่นผู้คืนอุปกรณ์ (สำหรับผู้ใช้ประเภทสาขา)
  returnerDepartment?: string; // แผนกผู้คืนอุปกรณ์ (สำหรับผู้ใช้ประเภทสาขา)
  returnerPhone?: string; // เบอร์โทรผู้คืนอุปกรณ์ (สำหรับผู้ใช้ประเภทสาขา)
  returnerOffice?: string; // ออฟฟิศ/สาขาผู้คืนอุปกรณ์ (สำหรับผู้ใช้ประเภทสาขา)
  returnDate: Date; // วันที่คืน
  items: IReturnItem[]; // รายการอุปกรณ์ที่คืน (แต่ละรายการมี approvalStatus แยกกัน)
  notes?: string; // หมายเหตุรวมการคืน
  
  createdAt: Date;
  updatedAt: Date;
}

const ReturnItemSchema = new Schema<IReturnItem>({
  itemId: { type: String, required: true },         // Reference to specific InventoryItem._id
  itemName: { type: String },                       // 🆕 Snapshot: ชื่ออุปกรณ์
  category: { type: String },                       // 🆕 Snapshot: ชื่อหมวดหมู่
  categoryId: { type: String },                     // 🆕 Snapshot: ID หมวดหมู่
  quantity: { type: Number, required: true, min: 1 },
  serialNumber: { type: String },                   // Serial Number
  numberPhone: { type: String },                    // Phone Number (สำหรับซิมการ์ด)
  assetNumber: { type: String },
  image: { type: String },                          // path ของรูปภาพ
  statusOnReturn: { type: String },                 // สถานะอุปกรณ์เมื่อคืน (มี/หาย - จาก status config)
  conditionOnReturn: { type: String },              // สภาพอุปกรณ์เมื่อคืน (ใช้งานได้/ชำรุด - จาก condition config)
  statusOnReturnName: { type: String },             // 🆕 Snapshot: ชื่อสถานะ
  conditionOnReturnName: { type: String },          // 🆕 Snapshot: ชื่อสภาพ
  itemNotes: { type: String },                      // หมายเหตุเฉพาะรายการ
  approvalStatus: { 
    type: String, 
    enum: ['pending', 'approved'], 
    default: 'pending' 
  },                                                // สถานะการอนุมัติ
  approvedAt: { type: Date },                       // วันที่อนุมัติ
  approvedBy: { type: String },                     // Admin userId ที่อนุมัติ
  approvedByName: { type: String }                  // 🆕 Snapshot: ชื่อ Admin
});

const ReturnLogSchema = new Schema<IReturnLog>({
  userId: { type: String, required: true },  // Reference to User._id
  // Store user info for branch users (who don't have user profiles)
  returnerFirstName: { type: String }, // ชื่อผู้คืนอุปกรณ์ (สำหรับผู้ใช้ประเภทสาขา)
  returnerLastName: { type: String }, // นามสกุลผู้คืนอุปกรณ์ (สำหรับผู้ใช้ประเภทสาขา)
  returnerNickname: { type: String }, // ชื่อเล่นผู้คืนอุปกรณ์ (สำหรับผู้ใช้ประเภทสาขา)
  returnerDepartment: { type: String }, // แผนกผู้คืนอุปกรณ์ (สำหรับผู้ใช้ประเภทสาขา)
  returnerPhone: { type: String }, // เบอร์โทรผู้คืนอุปกรณ์ (สำหรับผู้ใช้ประเภทสาขา)
  returnerOffice: { type: String }, // ออฟฟิศ/สาขาผู้คืนอุปกรณ์ (สำหรับผู้ใช้ประเภทสาขา)
  returnDate: { type: Date, required: true },
  items: [ReturnItemSchema],
  notes: { type: String }
}, {
  timestamps: true
});

// Recommended indexes
ReturnLogSchema.index({ returnDate: -1, createdAt: -1 });
ReturnLogSchema.index({ userId: 1 });
ReturnLogSchema.index({ 'items.approvalStatus': 1 });
ReturnLogSchema.index({ 'items.itemId': 1 });

// Force recreation to ensure schema updates during dev hot-reload
if (mongoose.models.ReturnLog) {
  delete mongoose.models.ReturnLog;
}

export default mongoose.model<IReturnLog>('ReturnLog', ReturnLogSchema);
