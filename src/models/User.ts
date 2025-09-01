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
  password: string;
  userType: 'individual' | 'branch'; // แบบบุคคลหรือแบบสาขา
  isMainAdmin?: boolean; // Admin หลักของระบบ (ampanusak@gmail.com)
  userRole: 'user' | 'admin' | 'it_admin'; // สถานะผู้ใช้ใหม่
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
  password: { type: String, required: true },
  userType: { 
    type: String, 
    enum: ['individual', 'branch'], 
    required: true,
    default: 'individual'
  },
  isMainAdmin: { type: Boolean, default: false }, // Admin หลักของระบบ (ampanusak@gmail.com)
  userRole: { 
    type: String, 
    enum: ['user', 'admin', 'it_admin'], 
    required: true,
    default: 'user'
  } // สถานะผู้ใช้: ทั่วไป, Admin, Admin ทีม IT
}, {
  timestamps: true
});

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
