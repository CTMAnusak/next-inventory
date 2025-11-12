import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  user_id: string; // User ID ที่ใช้อ้างอิงในระบบ (auto-generated)
  firstName?: string;
  lastName?: string;
  nickname?: string;
  department?: string;
  officeId?: string; // 🆕 Office ID สำหรับอ้างอิง
  officeName: string; // 🆕 Office Name (field เดียว - ไม่มี office field แล้ว)
  phone: string;
  email: string;
  password?: string; // Optional สำหรับ Google users
  userType: 'individual' | 'branch'; // แบบบุคคลหรือแบบสาขา
  isMainAdmin?: boolean; // Admin หลักของระบบ
  userRole: 'user' | 'admin' | 'it_admin' | 'super_admin'; // สถานะผู้ใช้ใหม่
  
  // Google OAuth Fields
  registrationMethod: 'manual' | 'google';
  googleId?: string;
  profilePicture?: string;
  isApproved: boolean; // สถานะการอนุมัติ
  approvedBy?: string; // Admin ที่อนุมัติ
  approvedAt?: Date;
  profileCompleted: boolean; // ครบข้อมูลหรือยัง
  allowedEmailDomains?: string[]; // เผื่ออนาคต
  
  // Fields สำหรับการลบ user
  pendingDeletion?: boolean; // รอการลบ
  pendingDeletionReason?: string; // เหตุผลการลบ
  pendingDeletionRequestedBy?: string; // Admin ที่ร้องขอลบ
  pendingDeletionRequestedAt?: Date; // วันที่ร้องขอลบ
  jwtInvalidatedAt?: Date; // วันที่ JWT token ถูก invalidate
  
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  user_id: { 
    type: String, 
    required: true, 
    unique: true
  },
  firstName: { 
    type: String, 
    required: function() { return this.userType === 'individual'; }
  },
  lastName: { 
    type: String, 
    required: function() { return this.userType === 'individual'; }
  },
  nickname: { 
    type: String, 
    required: function() { return this.userType === 'individual'; }
  },
  department: { 
    type: String, 
    required: function() { return this.userType === 'individual'; }
  },
  officeId: { type: String, index: true }, // 🆕 Office ID สำหรับอ้างอิง
  officeName: { 
    type: String,
    required: true // 🆕 ใช้ officeName เป็น field เดียว
  }, // 🆕 Office Name (field เดียว - ไม่มี office field แล้ว)
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { 
    type: String, 
    required: function() { return this.registrationMethod === 'manual'; }
  },
  userType: { 
    type: String, 
    enum: ['individual', 'branch'], 
    required: true,
    default: 'individual'
  },
  isMainAdmin: { type: Boolean, default: false },
  userRole: { 
    type: String, 
    enum: ['user', 'admin', 'it_admin', 'super_admin'], 
    required: true,
    default: 'user'
  },
  
  // Google OAuth Fields
  registrationMethod: {
    type: String,
    enum: ['manual', 'google'],
    required: true,
    default: 'manual'
  },
  googleId: { type: String, sparse: true },
  profilePicture: { type: String },
  isApproved: { type: Boolean, default: true }, // manual users auto-approved, google users need approval
  approvedBy: { type: String },
  approvedAt: { type: Date },
  profileCompleted: { type: Boolean, default: false },
  allowedEmailDomains: [{ type: String }],
  
  // Fields สำหรับการลบ user
  pendingDeletion: { type: Boolean, default: false },
  pendingDeletionReason: { type: String },
  pendingDeletionRequestedBy: { type: String },
  pendingDeletionRequestedAt: { type: Date },
  jwtInvalidatedAt: { type: Date }
}, {
  timestamps: true
});

// 🆕 Pre-save middleware: ตรวจสอบว่า officeName มีค่า
UserSchema.pre('save', function(next) {
  // ถ้าไม่มี officeName ให้ใช้ default
  if (!this.officeName) {
    this.officeName = 'ไม่ระบุสาขา';
    if (!this.officeId) {
      this.officeId = 'UNSPECIFIED_OFFICE';
    }
  }
  next();
});

// 🆕 Pre-update middleware: ลบ office field ออกและแปลงเป็น officeName
UserSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function(next) {
  const update = this.getUpdate() as any;
  if (update && typeof update === 'object') {
    // ถ้ามี $set
    if (update.$set) {
      // ถ้ามีการส่ง office มาแต่ไม่มี officeName ให้แปลงเป็น officeName
      if (update.$set.office && !update.$set.officeName) {
        update.$set.officeName = update.$set.office;
      }
      // ลบ office field ออกเสมอ (ไม่เก็บใน DB)
      delete update.$set.office;
    }
    // ถ้า update โดยตรง (ไม่ใช้ $set)
    if (update.office && !update.officeName) {
      update.officeName = update.office;
    }
    // ลบ office field ออกเสมอ (ไม่เก็บใน DB)
    delete update.office;
  }
  next();
});

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
