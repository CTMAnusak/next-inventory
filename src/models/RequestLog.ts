import mongoose, { Document, Schema } from 'mongoose';

export interface IAssignedItemSnapshot {
  itemId: string;           // InventoryItem._id
  itemName: string;         // Snapshot: ชื่ออุปกรณ์
  categoryId: string;       // Snapshot: ID หมวดหมู่
  categoryName: string;     // Snapshot: ชื่อหมวดหมู่
  serialNumber?: string;    // Snapshot: Serial Number
  numberPhone?: string;     // Snapshot: เบอร์โทรศัพท์ (ซิมการ์ด)
  statusId?: string;        // Snapshot: ID สถานะ
  statusName?: string;      // Snapshot: ชื่อสถานะ
  conditionId?: string;     // Snapshot: ID สภาพ
  conditionName?: string;   // Snapshot: ชื่อสภาพ
}

export interface IRequestItem {
  masterId: string;     // Reference to InventoryMaster._id (for lookup itemName/categoryId)
  itemName?: string;    // 🆕 Snapshot: ชื่ออุปกรณ์ (เก็บไว้เมื่อ InventoryMaster ถูกลบ)
  category?: string;    // 🆕 Snapshot: ชื่อหมวดหมู่ (เก็บไว้เมื่อ InventoryMaster ถูกลบ)
  categoryId?: string;  // 🆕 Snapshot: ID หมวดหมู่ (เก็บไว้เมื่อ InventoryMaster ถูกลบ)
  quantity: number;
  serialNumbers?: string[]; // Serial numbers if applicable (user request)
  assignedSerialNumbers?: string[]; // SN ที่ Admin assign ให้เมื่อ approve
  assignedItemIds?: string[]; // IDs ของ InventoryItem ที่ assign ให้
  assignedItemSnapshots?: IAssignedItemSnapshot[]; // 🆕 Snapshot: ข้อมูลอุปกรณ์ที่ assign แต่ละชิ้น
  assignedPhoneNumbers?: string[]; // Phone numbers ที่ Admin assign ให้ (สำหรับซิมการ์ด)
  availableItemIds?: string[]; // Available items for admin selection
  itemNotes?: string; // หมายเหตุของรายการเบิก (ไม่บังคับ)
  statusOnRequest?: string; // ID ของสถานะ (สภาพอุปกรณ์: มี/หาย) เมื่ออนุมัติ
  conditionOnRequest?: string; // ID ของสภาพ (สถานะอุปกรณ์: ใช้งานได้/ชำรุด) เมื่ออนุมัติ
  statusOnRequestName?: string; // 🆕 Snapshot: ชื่อสถานะ (สภาพอุปกรณ์)
  conditionOnRequestName?: string; // 🆕 Snapshot: ชื่อสภาพ (สถานะอุปกรณ์)
  assignedQuantity?: number; // จำนวนที่ Admin assign ให้แล้ว
  itemApproved?: boolean; // สถานะว่ารายการนี้ได้รับการอนุมัติแล้วหรือยัง
  approvedAt?: Date; // วันที่อนุมัติรายการนี้
}

export interface IRequestLog extends Document {
  // User info - store only userId for real-time lookup
  userId: string; // Reference to User._id for real-time lookup
  // Store user info for branch users (who don't have user profiles)
  requesterFirstName?: string; // ชื่อผู้ขอเบิก (สำหรับผู้ใช้ประเภทสาขา)
  requesterLastName?: string; // นามสกุลผู้ขอเบิก (สำหรับผู้ใช้ประเภทสาขา)
  requesterNickname?: string; // ชื่อเล่นผู้ขอเบิก (สำหรับผู้ใช้ประเภทสาขา)
  requesterDepartment?: string; // แผนกผู้ขอเบิก (สำหรับผู้ใช้ประเภทสาขา)
  requesterPhone?: string; // เบอร์โทรผู้ขอเบิก (สำหรับผู้ใช้ประเภทสาขา)
  requesterOffice?: string; // ออฟฟิศ/สาขาผู้ขอเบิก (สำหรับผู้ใช้ประเภทสาขา)
  requestDate: Date; // วันที่ต้องการเบิก
  urgency: 'very_urgent' | 'normal'; // ความเร่งด่วน
  deliveryLocation: string; // สถานที่จัดส่ง
  notes?: string; // หมายเหตุการเบิก (ไม่บังคับ)
  items: IRequestItem[]; // รายการอุปกรณ์ที่เบิก
  status: 'approved' | 'pending' | 'rejected' | 'completed'; // สถานะการเบิก
  requestType: 'request' | 'user-owned'; // ประเภท: การเบิก หรือ อุปกรณ์ที่ user เพิ่มเอง
  
  // Admin actions
  approvedAt?: Date;
  approvedBy?: string; // Admin userId
  approvedByName?: string; // 🆕 Snapshot: ชื่อ Admin ผู้อนุมัติ
  rejectedAt?: Date;
  rejectedBy?: string; // Admin userId
  rejectedByName?: string; // 🆕 Snapshot: ชื่อ Admin ผู้ปปฏิเสธ
  rejectionReason?: string;
  transferredItems?: any[]; // Items that were actually transferred
  
  createdAt: Date;
  updatedAt: Date;
}

const AssignedItemSnapshotSchema = new Schema({
  itemId: { type: String, required: true },
  itemName: { type: String, required: true },
  categoryId: { type: String, required: true },
  categoryName: { type: String, required: true },
  serialNumber: { type: String },
  numberPhone: { type: String },
  statusId: { type: String },
  statusName: { type: String },
  conditionId: { type: String },
  conditionName: { type: String }
}, { _id: false });

const RequestItemSchema = new Schema<IRequestItem>({
  masterId: { type: String, required: true },       // Reference to InventoryMaster._id
  itemName: { type: String },                       // 🆕 Snapshot: ชื่ออุปกรณ์
  category: { type: String },                       // 🆕 Snapshot: ชื่อหมวดหมู่
  categoryId: { type: String },                     // 🆕 Snapshot: ID หมวดหมู่
  quantity: { type: Number, required: true, min: 1 },
  serialNumbers: [{ type: String, required: false }],   // Serial numbers if available (user request)
  assignedSerialNumbers: [{ type: String, required: false }], // SN ที่ Admin assign ให้
  assignedItemIds: [{ type: String, required: false }],  // InventoryItem IDs ที่ assign ให้
  assignedItemSnapshots: [AssignedItemSnapshotSchema], // 🆕 Snapshot: ข้อมูลอุปกรณ์ที่ assign แต่ละชิ้น
  assignedPhoneNumbers: [{ type: String, required: false }], // Phone numbers ที่ Admin assign ให้
  availableItemIds: [{ type: String, required: false }],  // Available items for admin selection
  itemNotes: { type: String },
  statusOnRequest: { type: String }, // ID ของสถานะ (สภาพอุปกรณ์: มี/หาย) เมื่ออนุมัติ
  conditionOnRequest: { type: String }, // ID ของสภาพ (สถานะอุปกรณ์: ใช้งานได้/ชำรุด) เมื่ออนุมัติ
  statusOnRequestName: { type: String }, // 🆕 Snapshot: ชื่อสถานะ
  conditionOnRequestName: { type: String }, // 🆕 Snapshot: ชื่อสภาพ
  assignedQuantity: { type: Number, default: 0 }, // จำนวนที่ Admin assign ให้แล้ว
  itemApproved: { type: Boolean, default: false }, // สถานะว่ารายการนี้ได้รับการอนุมัติแล้วหรือยัง
  approvedAt: { type: Date } // วันที่อนุมัติรายการนี้
});

const RequestLogSchema = new Schema<IRequestLog>({
  userId: { type: String, required: true },  // Reference to User._id
  // Store user info for branch users (who don't have user profiles)
  requesterFirstName: { type: String }, // ชื่อผู้ขอเบิก (สำหรับผู้ใช้ประเภทสาขา)
  requesterLastName: { type: String }, // นามสกุลผู้ขอเบิก (สำหรับผู้ใช้ประเภทสาขา)
  requesterNickname: { type: String }, // ชื่อเล่นผู้ขอเบิก (สำหรับผู้ใช้ประเภทสาขา)
  requesterDepartment: { type: String }, // แผนกผู้ขอเบิก (สำหรับผู้ใช้ประเภทสาขา)
  requesterPhone: { type: String }, // เบอร์โทรผู้ขอเบิก (สำหรับผู้ใช้ประเภทสาขา)
  requesterOffice: { type: String }, // ออฟฟิศ/สาขาผู้ขอเบิก (สำหรับผู้ใช้ประเภทสาขา)
  requestDate: { type: Date, required: true },
  urgency: { 
    type: String, 
    enum: ['very_urgent', 'normal'], 
    required: true,
    default: 'normal'
  },
  deliveryLocation: { type: String, required: true },
  notes: { type: String },
  items: [RequestItemSchema],
  status: { 
    type: String, 
    enum: ['approved', 'pending', 'rejected', 'completed'], 
    default: 'pending'
  },
  requestType: {
    type: String,
    enum: ['request', 'user-owned'],
    required: true,
    default: 'request'
  },
  
  // Admin actions
  approvedAt: { type: Date },
  approvedBy: { type: String },
  approvedByName: { type: String }, // 🆕 Snapshot: ชื่อ Admin ผู้อนุมัติ
  rejectedAt: { type: Date },
  rejectedBy: { type: String },
  rejectedByName: { type: String }, // 🆕 Snapshot: ชื่อ Admin ผู้ปฏิเสธ
  rejectionReason: { type: String },
  transferredItems: [{ type: Schema.Types.Mixed }]
}, {
  timestamps: true
});

// Recommended indexes for frequent queries and sorts
RequestLogSchema.index({ requestDate: -1, createdAt: -1 });
RequestLogSchema.index({ userId: 1 });
RequestLogSchema.index({ status: 1 });
RequestLogSchema.index({ 'items.masterId': 1 });

// Force recompile model in dev/hot-reload to pick up schema changes
if (mongoose.models.RequestLog) {
  delete mongoose.models.RequestLog;
}

// Create and export model with updated schema
const RequestLog = mongoose.models.RequestLog || mongoose.model<IRequestLog>('RequestLog', RequestLogSchema);

export default RequestLog;
