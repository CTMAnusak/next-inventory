import mongoose, { Document, Schema } from 'mongoose';

export interface IIssueLog extends Document {
  issueId: string; // Issue ID เช่น IT1754894813221
  
  // ข้อมูลผู้แจ้งงาน (สำหรับการอ้างอิง)
  requesterType?: 'individual' | 'branch'; // ประเภทผู้แจ้ง
  requesterId?: string; // User ID สำหรับทั้ง individual และ branch
  officeId?: string; // Office ID สำหรับ populate (ใช้กับทั้ง 2 ประเภท)
  
  // ข้อมูลผู้แจ้งงาน (เก็บไว้สำหรับการแสดงผล - จะถูก populate จาก User ถ้าเป็น individual)
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  email: string;
  department: string;
  office: string; // สาขา/ออฟฟิศ (สำหรับ backward compatibility)
  officeName?: string; // 🆕 Office Name (populated field)
  
  issueCategory: string; // หัวข้อปัญหา
  customCategory?: string; // สำหรับ "อื่น ๆ (โปรดระบุ)"
  urgency: 'very_urgent' | 'normal'; // ระดับความเร่งด่วน
  description: string; // รายละเอียด
  images?: string[]; // รูปภาพที่อัปโหลด
  status: 'pending' | 'in_progress' | 'completed' | 'closed'; // สถานะ
  reportDate: Date; // วันที่แจ้ง
  acceptedDate?: Date; // วันที่แอดมินรับงาน
  completedDate?: Date; // วันที่ดำเนินการเสร็จ
  closedDate?: Date; // วันที่ปิดงาน
  notes?: string; // หมายเหตุ (deprecated - ใช้ notesHistory แทน)
  closeLink?: string; // ลิงค์สำหรับปิดงาน
  userId?: string; // ผู้ใช้ที่สร้างรายการ (อ้างอิง users._id) - deprecated, ใช้ requesterId แทน
  
  // ข้อมูล IT Admin ผู้รับผิดชอบ
  assignedAdminId?: string; // User ID ของ IT Admin ที่รับงาน (ใหม่)
  assignedAdmin?: {         // เก็บไว้เพื่อ backward compatibility
    name: string;
    email: string;
  };
  
  // ประวัติหมายเหตุจากแอดมิน (ใหม่)
  notesHistory?: Array<{
    note: string;
    adminId: string;
    adminName: string;
    createdAt: Date;
  }>;
  
  // ประวัติ feedback จากผู้ใช้ (ใหม่)
  userFeedbackHistory?: Array<{
    action: 'approved' | 'rejected';
    reason: string;
    submittedAt: Date;
  }>;
  
  closedAt?: Date; // เพิ่มฟิลด์ closedAt
  
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
  
  // ข้อมูลอ้างอิงผู้แจ้ง
  requesterType: { 
    type: String, 
    enum: ['individual', 'branch'],
    required: false // Optional for backward compatibility
  },
  requesterId: { 
    type: String, 
    required: false // เก็บ User ID สำหรับทั้ง individual และ branch
  },
  officeId: {
    type: String,
    required: false // เก็บ Office ID สำหรับ populate office name
  },
  
  // ข้อมูลผู้แจ้งที่บันทึกไว้
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  nickname: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  department: { type: String, required: true },
  office: { type: String, required: true }, // เก็บไว้สำหรับ backward compatibility
  officeName: { type: String }, // 🆕 Office Name (populated field)
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
      'อื่น ๆ (โปรดระบุ)'
    ]
  },
  customCategory: { 
    type: String,
    required: function() { return this.issueCategory === 'อื่น ๆ (โปรดระบุ)'; }
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
  acceptedDate: { type: Date },
  completedDate: { type: Date },
  closedDate: { type: Date },
  notes: { type: String },
  closeLink: { 
    type: String
  },
  userId: { type: String },
  
  // IT Admin ที่รับผิดชอบ
  assignedAdminId: { 
    type: String,
    required: false // User ID ของ IT Admin
  },
  assignedAdmin: {
    name: { type: String },
    email: { type: String }
  },
  
  // ประวัติหมายเหตุจากแอดมิน (ใหม่)
  notesHistory: [{
    note: { type: String, required: true },
    adminId: { type: String, required: true },
    adminName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  
  // ประวัติ feedback จากผู้ใช้ (ใหม่)
  userFeedbackHistory: [{
    action: { type: String, enum: ['approved', 'rejected'], required: true },
    reason: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now }
  }],
  
  closedAt: { type: Date }
}, {
  timestamps: true
});

export default mongoose.models.IssueLog || mongoose.model<IIssueLog>('IssueLog', IssueLogSchema);
