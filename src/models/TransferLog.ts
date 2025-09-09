import mongoose, { Document, Schema } from 'mongoose';

export interface ITransferLog extends Document {
  itemId: string;               // Reference to IInventoryItem._id
  itemName: string;
  category: string;
  serialNumber?: string;
  
  // ประเภทการ transfer
  transferType: 'user_report' | 'admin_add' | 'request_approved' | 'return_completed' | 'status_change' | 'ownership_change';
  
  // Ownership เดิม
  fromOwnership: {
    ownerType: 'admin_stock' | 'user_owned' | 'new_item';
    userId?: string;
  };
  
  // Ownership ใหม่
  toOwnership: {
    ownerType: 'admin_stock' | 'user_owned';
    userId?: string;
  };
  
  // ข้อมูลการ transfer
  transferDate: Date;
  processedBy?: string;         // Admin ที่ดำเนินการ
  approvedBy?: string;          // Admin ที่อนุมัติ (ถ้าต่าง)
  
  // Reference ไปยัง logs อื่น
  requestId?: string;           // Link to RequestLog
  returnId?: string;            // Link to ReturnLog
  
  // ข้อมูลเพิ่มเติม
  reason?: string;              // เหตุผลการ transfer
  notes?: string;               // หมายเหตุเพิ่มเติม
  
  // Status changes (ถ้ามี)
  statusChange?: {
    fromStatus: 'active' | 'maintenance' | 'damaged' | 'retired';
    toStatus: 'active' | 'maintenance' | 'damaged' | 'retired';
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const TransferLogSchema = new Schema<ITransferLog>({
  itemId: {
    type: String,
    required: true,
    index: true
  },
  itemName: {
    type: String,
    required: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    index: true
  },
  serialNumber: {
    type: String,
    sparse: true,
    index: true
  },
  
  // ประเภทการ transfer
  transferType: {
    type: String,
    enum: ['user_report', 'admin_add', 'request_approved', 'return_completed', 'status_change', 'ownership_change'],
    required: true,
    index: true
  },
  
  // Ownership เดิม
  fromOwnership: {
    ownerType: {
      type: String,
      enum: ['admin_stock', 'user_owned', 'new_item'],
      required: true
    },
    userId: {
      type: String,
      sparse: true,
      index: true
    }
  },
  
  // Ownership ใหม่
  toOwnership: {
    ownerType: {
      type: String,
      enum: ['admin_stock', 'user_owned'],
      required: true
    },
    userId: {
      type: String,
      sparse: true,
      index: true
    }
  },
  
  // ข้อมูลการ transfer
  transferDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  processedBy: {
    type: String,  // Admin user_id
    index: true
  },
  approvedBy: {
    type: String   // Admin user_id
  },
  
  // References
  requestId: {
    type: String,
    sparse: true,
    index: true
  },
  returnId: {
    type: String,
    sparse: true,
    index: true
  },
  
  // ข้อมูลเพิ่มเติม
  reason: {
    type: String
  },
  notes: {
    type: String
  },
  
  // Status changes
  statusChange: {
    fromStatus: {
      type: String,
      enum: ['active', 'maintenance', 'damaged', 'retired']
    },
    toStatus: {
      type: String,
      enum: ['active', 'maintenance', 'damaged', 'retired']
    }
  }
}, {
  timestamps: true
});

// Indexes สำหรับ performance
TransferLogSchema.index({ itemId: 1, transferDate: -1 });
TransferLogSchema.index({ transferType: 1, transferDate: -1 });
TransferLogSchema.index({ 'fromOwnership.userId': 1, transferDate: -1 });
TransferLogSchema.index({ 'toOwnership.userId': 1, transferDate: -1 });

// Static methods สำหรับ common operations
TransferLogSchema.statics.logTransfer = async function(transferData: Partial<ITransferLog>) {
  const log = new this({
    ...transferData,
    transferDate: transferData.transferDate || new Date()
  });
  
  return await log.save();
};

TransferLogSchema.statics.getItemHistory = function(itemId: string) {
  return this.find({ itemId })
    .sort({ transferDate: -1 })
    .exec();
};

TransferLogSchema.statics.getUserTransfers = function(userId: string, limit: number = 50) {
  return this.find({
    $or: [
      { 'fromOwnership.userId': userId },
      { 'toOwnership.userId': userId }
    ]
  })
  .sort({ transferDate: -1 })
  .limit(limit)
  .exec();
};

TransferLogSchema.statics.getAdminActivity = function(adminId: string, limit: number = 100) {
  return this.find({
    $or: [
      { processedBy: adminId },
      { approvedBy: adminId }
    ]
  })
  .sort({ transferDate: -1 })
  .limit(limit)
  .exec();
};

// Helper methods สำหรับสร้าง log entries
TransferLogSchema.statics.logUserReport = function(itemData: any, userId: string) {
  return this.logTransfer({
    itemId: itemData._id,
    itemName: itemData.itemName,
    category: itemData.category,
    serialNumber: itemData.serialNumber,
    transferType: 'user_report',
    fromOwnership: {
      ownerType: 'new_item'
    },
    toOwnership: {
      ownerType: 'user_owned',
      userId: userId
    },
    reason: 'User reported existing equipment'
  });
};

TransferLogSchema.statics.logAdminAdd = function(itemData: any, adminId: string) {
  return this.logTransfer({
    itemId: itemData._id,
    itemName: itemData.itemName,
    category: itemData.category,
    serialNumber: itemData.serialNumber,
    transferType: 'admin_add',
    fromOwnership: {
      ownerType: 'new_item'
    },
    toOwnership: {
      ownerType: 'admin_stock'
    },
    processedBy: adminId,
    reason: 'Admin added new equipment to stock'
  });
};

TransferLogSchema.statics.logRequestApproval = function(
  itemData: any, 
  fromUserId: string | undefined, 
  toUserId: string, 
  adminId: string, 
  requestId: string
) {
  return this.logTransfer({
    itemId: itemData._id,
    itemName: itemData.itemName,
    category: itemData.category,
    serialNumber: itemData.serialNumber,
    transferType: 'request_approved',
    fromOwnership: {
      ownerType: fromUserId ? 'user_owned' : 'admin_stock',
      userId: fromUserId
    },
    toOwnership: {
      ownerType: 'user_owned',
      userId: toUserId
    },
    processedBy: adminId,
    approvedBy: adminId,
    requestId: requestId,
    reason: 'Equipment request approved and assigned'
  });
};

TransferLogSchema.statics.logReturn = function(
  itemData: any, 
  fromUserId: string, 
  adminId: string, 
  returnId: string
) {
  return this.logTransfer({
    itemId: itemData._id,
    itemName: itemData.itemName,
    category: itemData.category,
    serialNumber: itemData.serialNumber,
    transferType: 'return_completed',
    fromOwnership: {
      ownerType: 'user_owned',
      userId: fromUserId
    },
    toOwnership: {
      ownerType: 'admin_stock'
    },
    processedBy: adminId,
    returnId: returnId,
    reason: 'Equipment returned to stock'
  });
};

// Force recreation of model to ensure schema updates
if (mongoose.models.TransferLog) {
  delete mongoose.models.TransferLog;
}

export default mongoose.model<ITransferLog>('TransferLog', TransferLogSchema);
