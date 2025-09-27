import mongoose, { Document, Schema } from 'mongoose';

export interface IReturnItem {
  itemId: string;       // Reference to specific InventoryItem._id being returned
  quantity: number;
  serialNumber?: string; // Serial Number (ถ้ามี)
  numberPhone?: string; // Phone Number (สำหรับซิมการ์ด)
  assetNumber?: string; // เลขทรัพย์สิน
  image?: string; // รูปภาพ
  conditionOnReturn?: string; // สถานะเมื่อคืน (ใช้งานได้/ชำรุด)
  itemNotes?: string; // หมายเหตุเฉพาะรายการ
}

export interface IReturnLog extends Document {
  // User info - store only userId for real-time lookup
  userId: string; // Reference to User._id for real-time lookup
  returnDate: Date; // วันที่คืน
  items: IReturnItem[]; // รายการอุปกรณ์ที่คืน
  status: 'completed' | 'pending'; // สถานะการคืน
  notes?: string; // หมายเหตุรวมการคืน
  
  // Admin actions
  processedAt?: Date;
  processedBy?: string; // Admin userId
  
  createdAt: Date;
  updatedAt: Date;
}

const ReturnItemSchema = new Schema<IReturnItem>({
  itemId: { type: String, required: true },         // Reference to specific InventoryItem._id
  quantity: { type: Number, required: true, min: 1 },
  serialNumber: { type: String },                   // Serial Number
  numberPhone: { type: String },                    // Phone Number (สำหรับซิมการ์ด)
  assetNumber: { type: String },
  image: { type: String },                          // path ของรูปภาพ
  conditionOnReturn: { type: String },              // สถานะเมื่อคืน (ใช้งานได้/ชำรุด)
  itemNotes: { type: String }                       // หมายเหตุเฉพาะรายการ
});

const ReturnLogSchema = new Schema<IReturnLog>({
  userId: { type: String, required: true },  // Reference to User._id
  returnDate: { type: Date, required: true },
  items: [ReturnItemSchema],
  status: { 
    type: String, 
    enum: ['completed', 'pending'], 
    default: 'pending'
  },
  notes: { type: String },
  
  // Admin actions
  processedAt: { type: Date },
  processedBy: { type: String }
}, {
  timestamps: true
});

export default mongoose.models.ReturnLog || mongoose.model<IReturnLog>('ReturnLog', ReturnLogSchema);
