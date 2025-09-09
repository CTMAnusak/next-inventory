import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  user_id: string; // User ID ที่ใช้อ้างอิงในระบบ (auto-generated)
  firstName?: string;
  lastName?: string;
  nickname?: string;
  department?: string;
  office: string; // สาขา/ออฟฟิศ
  phone: string;
  email: string;
  password?: string; // Optional สำหรับ Google users
  userType: 'individual' | 'branch'; // แบบบุคคลหรือแบบสาขา
  isMainAdmin?: boolean; // Admin หลักของระบบ
  userRole: 'user' | 'admin' | 'it_admin'; // สถานะผู้ใช้ใหม่
  
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
  office: { type: String, required: true },
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
    enum: ['user', 'admin', 'it_admin'], 
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

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
