import mongoose, { Schema, Document } from 'mongoose';

export interface ICategoryConfig {
  id: string;                    // Unique identifier for the category
  name: string;                  // Display name of the category
  isSystemCategory: boolean;     // System categories cannot be deleted (e.g., "ไม่ระบุ")
  order: number;                 // Display order
  createdAt: Date;
  updatedAt: Date;
}

export interface IStatusConfig {
  id: string;                    // Unique identifier for the status (สภาพอุปกรณ์: มี/หาย)
  name: string;                  // Display name of the status
  order: number;                 // Display order for drag & drop
  isSystemConfig: boolean;       // System configs cannot be deleted
  createdAt: Date;
  updatedAt: Date;
}

export interface IConditionConfig {
  id: string;                    // Unique identifier for the condition (สถานะอุปกรณ์: ใช้งานได้/ชำรุด)
  name: string;                  // Display name of the condition
  order: number;                 // Display order for drag & drop
  isSystemConfig: boolean;       // System configs cannot be deleted
  createdAt: Date;
  updatedAt: Date;
}

export interface IInventoryConfig extends Document {
  statusConfigs: IStatusConfig[];      // สภาพอุปกรณ์ (มี/หาย)
  conditionConfigs: IConditionConfig[]; // สถานะอุปกรณ์ (ใช้งานได้/ชำรุด)
  categoryConfigs: ICategoryConfig[];   // หมวดหมู่อุปกรณ์
}

// Default status configurations (สภาพอุปกรณ์)
export const DEFAULT_STATUS_CONFIGS: IStatusConfig[] = [
  {
    id: 'status_available',
    name: 'มี',
    order: 1,
    isSystemConfig: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'status_missing',
    name: 'หาย',
    order: 2,
    isSystemConfig: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Default condition configurations (สถานะอุปกรณ์)
const DEFAULT_CONDITION_CONFIGS: IConditionConfig[] = [
  {
    id: 'cond_working',
    name: 'ใช้งานได้',
    order: 1,
    isSystemConfig: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'cond_damaged',
    name: 'ชำรุด',
    order: 2,
    isSystemConfig: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Default category configurations - มี "ซิมการ์ด" และ "ไม่ระบุ"
const DEFAULT_CATEGORY_CONFIGS: ICategoryConfig[] = [
  {
    id: 'cat_sim_card',
    name: 'ซิมการ์ด',
    isSystemCategory: true, // Cannot be deleted
    order: 1, // Top priority (can be reordered)
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'cat_unassigned',
    name: 'ไม่ระบุ',
    isSystemCategory: true, // Cannot be deleted
    order: 999, // Always at the bottom (cannot be reordered)
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Schema for category configuration
const CategoryConfigSchema = new Schema<ICategoryConfig>({
  id: { 
    type: String, 
    required: true,
    unique: false // Will be unique within the parent document
  },
  name: { 
    type: String, 
    required: true 
  },
  isSystemCategory: { 
    type: Boolean, 
    default: false 
  },
  order: { 
    type: Number, 
    required: true 
  }
}, { timestamps: true });

// Schema for status configuration (สภาพอุปกรณ์)
const StatusConfigSchema = new Schema<IStatusConfig>({
  id: { 
    type: String, 
    required: true,
    unique: false
  },
  name: { 
    type: String, 
    required: true 
  },
  order: { 
    type: Number, 
    required: true 
  },
  isSystemConfig: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Schema for condition configuration (สถานะอุปกรณ์)
const ConditionConfigSchema = new Schema<IConditionConfig>({
  id: { 
    type: String, 
    required: true,
    unique: false
  },
  name: { 
    type: String, 
    required: true 
  },
  order: { 
    type: Number, 
    required: true 
  },
  isSystemConfig: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const InventoryConfigSchema = new Schema<IInventoryConfig>(
  {
    statusConfigs: {
      type: [StatusConfigSchema],
      default: DEFAULT_STATUS_CONFIGS
    },
    conditionConfigs: {
      type: [ConditionConfigSchema], 
      default: DEFAULT_CONDITION_CONFIGS
    },
    categoryConfigs: {
      type: [CategoryConfigSchema],
      default: DEFAULT_CATEGORY_CONFIGS
    }
  }
);

// Helper functions for category management
export const generateCategoryId = (): string => {
  return `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const createDefaultCategoryConfig = (name: string, order: number): ICategoryConfig => {
  return {
    id: generateCategoryId(),
    name,
    isSystemCategory: false,
    order,
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

// Helper functions for status management (สภาพอุปกรณ์)
export const generateStatusId = (): string => {
  return `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const createStatusConfig = (name: string, order: number): IStatusConfig => {
  return {
    id: generateStatusId(),
    name,
    order,
    isSystemConfig: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

// Helper functions for condition management (สถานะอุปกรณ์)
export const generateConditionId = (): string => {
  return `cond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const createConditionConfig = (name: string, order: number): IConditionConfig => {
  return {
    id: generateConditionId(),
    name,
    order,
    isSystemConfig: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

// Static methods for the model
InventoryConfigSchema.statics.findCategoryById = function(categoryId: string) {
  return this.findOne({ 'categoryConfigs.id': categoryId });
};

InventoryConfigSchema.statics.getCategoryConfig = function(categoryId: string) {
  return this.aggregate([
    { $unwind: '$categoryConfigs' },
    { $match: { 'categoryConfigs.id': categoryId } },
    { $replaceRoot: { newRoot: '$categoryConfigs' } }
  ]);
};

// Static methods for status management (สภาพอุปกรณ์)
InventoryConfigSchema.statics.findStatusById = function(statusId: string) {
  return this.findOne({ 'statusConfigs.id': statusId });
};

InventoryConfigSchema.statics.getStatusConfig = function(statusId: string) {
  return this.aggregate([
    { $unwind: '$statusConfigs' },
    { $match: { 'statusConfigs.id': statusId } },
    { $replaceRoot: { newRoot: '$statusConfigs' } }
  ]);
};

// Static methods for condition management (สถานะอุปกรณ์)
InventoryConfigSchema.statics.findConditionById = function(conditionId: string) {
  return this.findOne({ 'conditionConfigs.id': conditionId });
};

InventoryConfigSchema.statics.getConditionConfig = function(conditionId: string) {
  return this.aggregate([
    { $unwind: '$conditionConfigs' },
    { $match: { 'conditionConfigs.id': conditionId } },
    { $replaceRoot: { newRoot: '$conditionConfigs' } }
  ]);
};

// Export the model
const InventoryConfig = mongoose.models.InventoryConfig ||
  mongoose.model<IInventoryConfig>('InventoryConfig', InventoryConfigSchema);

export default InventoryConfig;

// Export constants for use in other parts of the application
export { 
  DEFAULT_CATEGORY_CONFIGS, 
  DEFAULT_CONDITION_CONFIGS 
};


