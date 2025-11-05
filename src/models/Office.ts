import mongoose, { Document, Schema } from 'mongoose';

export interface IOffice extends Document {
  office_id: string; // Office ID ที่ใช้อ้างอิงในระบบ (เช่น OFF001, OFF002)
  name: string; // ชื่อสาขา/ออฟฟิศ (เช่น "Rasa One", "CTW", "รสา")
  description?: string; // คำอธิบายเพิ่มเติม
  isActive: boolean; // สถานะการใช้งาน (สำหรับ soft delete)
  isSystemOffice?: boolean; // 🆕 ระบบ Office ที่ไม่สามารถลบได้ (เช่น "ไม่ระบุสาขา")
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // Soft delete timestamp
}

const OfficeSchema = new Schema<IOffice>({
  office_id: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  name: { 
    type: String, 
    required: true,
    trim: true,
    index: true
  },
  description: { 
    type: String,
    trim: true
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true
  },
  isSystemOffice: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: { 
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index สำหรับค้นหาที่ใช้งานได้
OfficeSchema.index({ isActive: 1, deletedAt: 1 });
OfficeSchema.index({ name: 1, isActive: 1 });

export default mongoose.models.Office || mongoose.model<IOffice>('Office', OfficeSchema);

