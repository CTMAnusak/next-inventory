import mongoose, { Document, Schema } from 'mongoose';

export interface IRequestItem {
  masterId: string;     // Reference to InventoryMaster._id (for lookup itemName/categoryId)
  quantity: number;
  serialNumbers?: string[]; // Serial numbers if applicable (user request)
  assignedSerialNumbers?: string[]; // SN ที่ Admin assign ให้เมื่อ approve
  assignedItemIds?: string[]; // IDs ของ InventoryItem ที่ assign ให้
  assignedPhoneNumbers?: string[]; // Phone numbers ที่ Admin assign ให้ (สำหรับซิมการ์ด)
  availableItemIds?: string[]; // Available items for admin selection
  itemNotes?: string; // หมายเหตุของรายการเบิก (ไม่บังคับ)
  statusOnRequest?: string; // ID ของสถานะ (สภาพอุปกรณ์: มี/หาย) เมื่ออนุมัติ
  conditionOnRequest?: string; // ID ของสภาพ (สถานะอุปกรณ์: ใช้งานได้/ชำรุด) เมื่ออนุมัติ
}

export interface IRequestLog extends Document {
  // User info - store only userId for real-time lookup
  userId: string; // Reference to User._id for real-time lookup
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
  rejectedAt?: Date;
  rejectedBy?: string; // Admin userId
  rejectionReason?: string;
  transferredItems?: any[]; // Items that were actually transferred
  
  createdAt: Date;
  updatedAt: Date;
}

const RequestItemSchema = new Schema<IRequestItem>({
  masterId: { type: String, required: true },       // Reference to InventoryMaster._id
  quantity: { type: Number, required: true, min: 1 },
  serialNumbers: [{ type: String, required: false }],   // Serial numbers if available (user request)
  assignedSerialNumbers: [{ type: String, required: false }], // SN ที่ Admin assign ให้
  assignedItemIds: [{ type: String, required: false }],  // InventoryItem IDs ที่ assign ให้
  assignedPhoneNumbers: [{ type: String, required: false }], // Phone numbers ที่ Admin assign ให้
  availableItemIds: [{ type: String, required: false }],  // Available items for admin selection
  itemNotes: { type: String },
  statusOnRequest: { type: String }, // ID ของสถานะ (สภาพอุปกรณ์: มี/หาย) เมื่ออนุมัติ
  conditionOnRequest: { type: String } // ID ของสภาพ (สถานะอุปกรณ์: ใช้งานได้/ชำรุด) เมื่ออนุมัติ
});

const RequestLogSchema = new Schema<IRequestLog>({
  userId: { type: String, required: true },  // Reference to User._id
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
  rejectedAt: { type: Date },
  rejectedBy: { type: String },
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
