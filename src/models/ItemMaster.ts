import mongoose, { Document, Schema } from 'mongoose';

export interface IItemMaster extends Document {
  itemName: string;              // ชื่ออุปกรณ์ เช่น "เมาส์ Logitech MX Master 3"
  categoryId: string;            // Reference to categoryConfigs.id
  hasSerialNumber: boolean;      // บอกว่าประเภทนี้มี SN หรือไม่
  isActive: boolean;             // สำหรับ soft delete
  
  // ข้อมูลการสร้าง
  createdBy: string;             // User ID ที่สร้าง (admin หรือ user)
  createdAt: Date;
  updatedAt: Date;
}

const ItemMasterSchema = new Schema<IItemMaster>({
  itemName: { 
    type: String, 
    required: true,
    trim: true,
    index: true
  },
  categoryId: { 
    type: String, 
    required: true,
    index: true
  },
  hasSerialNumber: {
    type: Boolean,
    required: true,
    default: false
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true
  },
  createdBy: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Compound index สำหรับ uniqueness
ItemMasterSchema.index({ itemName: 1, categoryId: 1 }, { unique: true });

// Index สำหรับ active items
ItemMasterSchema.index({ isActive: 1, categoryId: 1 });

// Static methods
ItemMasterSchema.statics.findActiveByCategory = function(categoryId: string) {
  return this.find({ 
    categoryId, 
    isActive: true 
  }).sort({ itemName: 1 });
};

ItemMasterSchema.statics.findByNameAndCategory = function(itemName: string, categoryId: string) {
  return this.findOne({ 
    itemName, 
    categoryId, 
    isActive: true 
  });
};

// Validation
ItemMasterSchema.pre('save', function(next) {
  // Validate categoryId exists (จะเพิ่ม validation ภายหลัง)
  next();
});

// Force recreation of model to ensure schema updates
if (mongoose.models.ItemMaster) {
  delete mongoose.models.ItemMaster;
}

const ItemMaster = mongoose.model<IItemMaster>('ItemMaster', ItemMasterSchema);
export { ItemMaster };
export default ItemMaster;
