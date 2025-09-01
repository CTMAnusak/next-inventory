import mongoose, { Document, Schema } from 'mongoose';

export interface IInventoryItem extends Document {
  itemName: string;
  category: string;
  serialNumber?: string;        // SN เฉพาะของชิ้นนี้ (ถ้ามี)
  status: 'active' | 'maintenance' | 'damaged' | 'retired' | 'deleted';
  
  // Ownership ปัจจุบัน
  currentOwnership: {
    ownerType: 'admin_stock' | 'user_owned';
    userId?: string;            // มีเฉพาะ user_owned
    ownedSince: Date;
    assignedBy?: string;        // Admin ที่มอบหมาย (สำหรับ tracking)
  };
  
  // ข้อมูลต้นกำเนิด
  sourceInfo: {
    addedBy: 'admin' | 'user';
    addedByUserId?: string;     // มีเฉพาะเมื่อ user เพิ่ม
    dateAdded: Date;
    initialOwnerType: 'admin_stock' | 'user_owned';
    acquisitionMethod: 'self_reported' | 'admin_purchased' | 'transferred';
    notes?: string;
  };
  
  // ข้อมูลการ transfer (ถ้ามี)
  transferInfo?: {
    transferredFrom: 'admin_stock' | 'user_owned';
    transferDate: Date;
    approvedBy: string;
    requestId?: string;         // Link ไป RequestLog
    returnId?: string;          // Link ไป ReturnLog
  };
  
  // ข้อมูลการลบ (soft delete)
  deletedAt?: Date;
  deleteReason?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const InventoryItemSchema = new Schema<IInventoryItem>({
  itemName: { 
    type: String, 
    required: true,
    index: true  // สำหรับ query ที่เร็วขึ้น
  },
  category: { 
    type: String, 
    required: true,
    index: true
  },
  serialNumber: { 
    type: String,
    sparse: true   // อนุญาตให้เป็น null/undefined แต่ไม่ enforce unique constraint
    // Note: ลบ unique: true เพื่อป้องกัน E11000 error กับ null values
    // Application-level validation จะตรวจสอบความซ้ำแทน
  },
  status: { 
    type: String, 
    enum: ['active', 'maintenance', 'damaged', 'retired', 'deleted'], 
    default: 'active',
    index: true
  },
  
  // Ownership ปัจจุบัน
  currentOwnership: {
    ownerType: {
      type: String,
      enum: ['admin_stock', 'user_owned'],
      required: true,
      index: true  // สำหรับ query ownership
    },
    userId: {
      type: String,
      sparse: true,  // มีเฉพาะ user_owned
      index: true    // สำหรับ query user equipment
    },
    ownedSince: {
      type: Date,
      required: true,
      default: Date.now
    },
    assignedBy: {
      type: String,  // Admin user_id ที่มอบหมาย
      sparse: true
    }
  },
  
  // ข้อมูลต้นกำเนิด
  sourceInfo: {
    addedBy: {
      type: String,
      enum: ['admin', 'user'],
      required: true
    },
    addedByUserId: {
      type: String,
      sparse: true  // มีเฉพาะเมื่อ user เพิ่ม
    },
    dateAdded: {
      type: Date,
      required: true,
      default: Date.now
    },
    initialOwnerType: {
      type: String,
      enum: ['admin_stock', 'user_owned'],
      required: true
    },
    acquisitionMethod: {
      type: String,
      enum: ['self_reported', 'admin_purchased', 'transferred'],
      required: true
    },
    notes: {
      type: String
    }
  },
  
  // ข้อมูลการ transfer
  transferInfo: {
    transferredFrom: {
      type: String,
      enum: ['admin_stock', 'user_owned']
    },
    transferDate: {
      type: Date
    },
    approvedBy: {
      type: String  // Admin user_id
    },
    requestId: {
      type: String  // Link to RequestLog
    },
    returnId: {
      type: String  // Link to ReturnLog
    }
  },
  
  // ข้อมูลการลบ (soft delete)
  deletedAt: {
    type: Date
  },
  deleteReason: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes สำหรับ performance
InventoryItemSchema.index({ itemName: 1, category: 1 });
InventoryItemSchema.index({ 'currentOwnership.ownerType': 1, 'currentOwnership.userId': 1 });
InventoryItemSchema.index({ 'sourceInfo.addedBy': 1, 'sourceInfo.addedByUserId': 1 });

// Pre-save validation
InventoryItemSchema.pre('save', function(next) {
  // ตรวจสอบว่า user_owned ต้องมี userId
  if (this.currentOwnership.ownerType === 'user_owned' && !this.currentOwnership.userId) {
    return next(new Error('user_owned items must have userId'));
  }
  
  // ตรวจสอบว่า admin_stock ต้องไม่มี userId
  if (this.currentOwnership.ownerType === 'admin_stock' && this.currentOwnership.userId) {
    this.currentOwnership.userId = undefined;
  }
  
  // ตรวจสอบว่า user เพิ่มต้องมี addedByUserId
  if (this.sourceInfo.addedBy === 'user' && !this.sourceInfo.addedByUserId) {
    return next(new Error('User-added items must have addedByUserId'));
  }
  
  // ตรวจสอบว่า admin เพิ่มต้องไม่มี addedByUserId
  if (this.sourceInfo.addedBy === 'admin' && this.sourceInfo.addedByUserId) {
    this.sourceInfo.addedByUserId = undefined;
  }
  
  next();
});

// Static methods สำหรับ common queries
InventoryItemSchema.statics.findAvailableByName = function(itemName: string) {
  return this.find({
    itemName: itemName,
    'currentOwnership.ownerType': 'admin_stock',
    status: 'active'
  });
};

InventoryItemSchema.statics.findUserOwned = function(userId: string) {
  return this.find({
    'currentOwnership.ownerType': 'user_owned',
    'currentOwnership.userId': userId,
    status: { $ne: 'retired' }
  });
};

// Force recreation of model to ensure schema updates
if (mongoose.models.InventoryItem) {
  delete mongoose.models.InventoryItem;
}

const InventoryItem = mongoose.model<IInventoryItem>('InventoryItem', InventoryItemSchema);
export { InventoryItem };
export default InventoryItem;
