import mongoose, { Schema, Document } from 'mongoose';

export interface ICategoryConfig {
  id: string;                    // Unique identifier for the category
  name: string;                  // Display name of the category
  isSpecial: boolean;            // Whether this is a special category (requires 2-step deletion)
  isSystemCategory: boolean;     // System categories cannot be deleted (e.g., "ไม่ระบุ")
  order: number;                 // Display order
  createdAt: Date;
  updatedAt: Date;
}

export interface IInventoryConfig extends Document {
  statuses: string[];
  categoryConfigs: ICategoryConfig[];
  
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_STATUSES = ['active', 'maintenance', 'damaged', 'retired'];

// Default category configurations
const DEFAULT_CATEGORY_CONFIGS: ICategoryConfig[] = [
  {
    id: 'cat_computer',
    name: 'คอมพิวเตอร์และแล็ปท็อป',
    isSpecial: false,
    isSystemCategory: false,
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'cat_network',
    name: 'อุปกรณ์เครือข่าย',
    isSpecial: false,
    isSystemCategory: false,
    order: 2,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'cat_printer',
    name: 'ปริ้นเตอร์และสแกนเนอร์',
    isSpecial: false,
    isSystemCategory: false,
    order: 3,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'cat_accessories',
    name: 'อุปกรณ์เสริม',
    isSpecial: false,
    isSystemCategory: false,
    order: 4,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'cat_software',
    name: 'ซอฟต์แวร์',
    isSpecial: false,
    isSystemCategory: false,
    order: 5,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'cat_other',
    name: 'อื่นๆ',
    isSpecial: false,
    isSystemCategory: false,
    order: 6,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'cat_unassigned',
    name: 'ไม่ระบุ',
    isSpecial: false,
    isSystemCategory: true, // Cannot be deleted
    order: 999, // Always at the bottom
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
  isSpecial: { 
    type: Boolean, 
    default: false 
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

const InventoryConfigSchema = new Schema<IInventoryConfig>(
  {
    statuses: { type: [String], default: DEFAULT_STATUSES },
    categoryConfigs: {
      type: [CategoryConfigSchema],
      default: DEFAULT_CATEGORY_CONFIGS
    }
  },
  { timestamps: true }
);

// Helper functions for category management
export const generateCategoryId = (): string => {
  return `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const createDefaultCategoryConfig = (name: string, order: number, isSpecial: boolean = false): ICategoryConfig => {
  return {
    id: generateCategoryId(),
    name,
    isSpecial,
    isSystemCategory: false,
    order,
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

// Export the model
const InventoryConfig = mongoose.models.InventoryConfig ||
  mongoose.model<IInventoryConfig>('InventoryConfig', InventoryConfigSchema);

export default InventoryConfig;

// Export constants for use in other parts of the application
export { DEFAULT_STATUSES, DEFAULT_CATEGORY_CONFIGS };


