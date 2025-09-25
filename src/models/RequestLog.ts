import mongoose, { Document, Schema } from 'mongoose';

export interface IRequestItem {
  itemId: string;       // Primary reference to inventory item
  quantity: number;
  itemName?: string;    // Item name for display purposes
  category?: string;    // Category for display
  statusOnRequest?: string; // สภาพเมื่อเบิก (มี/หาย)
  conditionOnRequest?: string; // สถานะเมื่อเบิก (ใช้งานได้/ชำรุด)
  serialNumbers?: string[]; // Serial numbers if applicable (user request)
  assignedSerialNumbers?: string[]; // SN ที่ Admin assign ให้เมื่อ approve
  assignedItemIds?: string[]; // IDs ของ InventoryItem ที่ assign ให้
  assignedPhoneNumbers?: string[]; // Phone numbers ที่ Admin assign ให้ (สำหรับซิมการ์ด)
}

export interface IRequestLog extends Document {
  firstName: string;
  lastName: string;
  nickname: string;
  department: string;
  office: string; // สาขา/ออฟฟิศ
  requestDate: Date; // วันที่ต้องการเบิก
  urgency: 'very_urgent' | 'normal'; // ความเร่งด่วน
  deliveryLocation: string; // สถานที่จัดส่ง
  phone: string;
  reason: string; // เหตุผลการเบิก
  items: IRequestItem[]; // รายการอุปกรณ์ที่เบิก
  status: 'approved' | 'pending' | 'rejected' | 'completed'; // สถานะการเบิก
  requestType: 'request' | 'user-owned'; // ประเภท: การเบิก หรือ อุปกรณ์ที่ user เพิ่มเอง
  userId?: string; // ผู้ใช้ที่สร้างรายการ (อ้างอิง users._id)
  createdAt: Date;
  updatedAt: Date;
}

const RequestItemSchema = new Schema<IRequestItem>({
  itemId: { type: String, required: true },         // Primary reference to inventory
  quantity: { type: Number, required: true, min: 1 },
  itemName: { type: String, required: false },      // Item name for display
  category: { type: String, required: false },      // Category for display
  statusOnRequest: { type: String, required: false }, // สภาพเมื่อเบิก (มี/หาย)
  conditionOnRequest: { type: String, required: false }, // สถานะเมื่อเบิก (ใช้งานได้/ชำรุด)
  serialNumbers: [{ type: String, required: false }],   // Serial numbers if available (user request)
  assignedSerialNumbers: [{ type: String, required: false }], // SN ที่ Admin assign ให้
  assignedItemIds: [{ type: String, required: false }],  // InventoryItem IDs ที่ assign ให้
  assignedPhoneNumbers: [{ type: String, required: false }] // Phone numbers ที่ Admin assign ให้ (สำหรับซิมการ์ด)
});

const RequestLogSchema = new Schema<IRequestLog>({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  nickname: { type: String, required: false, default: '' },
  department: { type: String, required: false, default: '' },
  office: { type: String, required: true },
  requestDate: { type: Date, required: true },
  urgency: { 
    type: String, 
    enum: ['very_urgent', 'normal'], 
    required: true,
    default: 'normal'
  },
  deliveryLocation: { type: String, required: true },
  phone: { type: String, required: false, default: '' },
  reason: { type: String, required: true },
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
  userId: { type: String }
}, {
  timestamps: true
});

// Force recompile model in dev/hot-reload to pick up schema changes
if (mongoose.models.RequestLog) {
  delete mongoose.models.RequestLog;
}

// Create and export model with updated schema
const RequestLog = mongoose.models.RequestLog || mongoose.model<IRequestLog>('RequestLog', RequestLogSchema);

export default RequestLog;
