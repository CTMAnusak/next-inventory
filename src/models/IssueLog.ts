import mongoose, { Document, Schema } from 'mongoose';

export interface IIssueLog extends Document {
  issueId: string; // Issue ID เช่น IT1754894813221
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  email: string;
  department: string;
  office: string; // สาขา/ออฟฟิศ
  issueCategory: string; // หัวข้อปัญหา
  customCategory?: string; // สำหรับ "อื่น ๆ โปรดระบุ"
  urgency: 'very_urgent' | 'normal'; // ระดับความเร่งด่วน
  description: string; // รายละเอียด
  images?: string[]; // รูปภาพที่อัปโหลด
  status: 'pending' | 'in_progress' | 'completed' | 'closed'; // สถานะ
  reportDate: Date; // วันที่แจ้ง
  completedDate?: Date; // วันที่ดำเนินการเสร็จ
  closedDate?: Date; // วันที่ปิดงาน
  notes?: string; // หมายเหตุ
  closeLink?: string; // ลิงค์สำหรับปิดงาน
  userId?: string; // ผู้ใช้ที่สร้างรายการ (อ้างอิง users._id)
  createdAt: Date;
  updatedAt: Date;
}

const IssueLogSchema = new Schema<IIssueLog>({
  issueId: { 
    type: String, 
    required: true, 
    unique: true,
    default: function() {
      return 'IT' + Date.now() + Math.floor(Math.random() * 1000);
    }
  },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  nickname: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  department: { type: String, required: true },
  office: { type: String, required: true },
  issueCategory: { 
    type: String, 
    required: true,
    enum: [
      'ปัญหา Internet',
      'ปัญหา Notebook/Computer',
      'ปัญหา ปริ้นเตอร์ และ อุปกรณ์',
      'ปัญหา TV/VDO Conference',
      'ปัญหา ตู้ฝากเงิน',
      'ปัญหา อุปกรณ์ มือถือและแท็บเลต',
      'ปัญหา เบอร์โทรศัพท์',
      'ปัญหา Nas เข้าไม่ได้ ใช้งานไม่ได้',
      'ขอ User Account Email ระบบงาน',
      'อื่น ๆ โปรดระบุ'
    ]
  },
  customCategory: { 
    type: String,
    required: function() { return this.issueCategory === 'อื่น ๆ โปรดระบุ'; }
  },
  urgency: { 
    type: String, 
    enum: ['very_urgent', 'normal'], 
    required: true,
    default: 'normal'
  },
  description: { type: String, required: true },
  images: [{ type: String }], // array ของ path รูปภาพ
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed', 'closed'], 
    default: 'pending'
  },
  reportDate: { type: Date, default: Date.now },
  completedDate: { type: Date },
  closedDate: { type: Date },
  notes: { type: String },
  closeLink: { 
    type: String,
    default: function() {
      return `/close-issue/${this.issueId}`;
    }
  },
  userId: { type: String },
  assignedAdmin: {
    name: { type: String },
    email: { type: String }
  },
  userFeedback: {
    action: { type: String, enum: ['approved', 'rejected'] },
    reason: { type: String },
    submittedAt: { type: Date }
  },
  closedAt: { type: Date }
}, {
  timestamps: true
});

export default mongoose.models.IssueLog || mongoose.model<IIssueLog>('IssueLog', IssueLogSchema);
