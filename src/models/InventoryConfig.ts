import mongoose, { Schema, Document } from 'mongoose';

export interface IInventoryConfig extends Document {
  categories: string[];
  statuses: string[];
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_CATEGORIES = [
  'คอมพิวเตอร์และแล็ปท็อป',
  'อุปกรณ์เครือข่าย',
  'ปริ้นเตอร์และสแกนเนอร์',
  'อุปกรณ์เสริม',
  'ซอฟต์แวร์',
  'อื่นๆ',
];

const DEFAULT_STATUSES = ['active', 'maintenance', 'damaged', 'retired'];

const InventoryConfigSchema = new Schema<IInventoryConfig>(
  {
    categories: { type: [String], default: DEFAULT_CATEGORIES },
    statuses: { type: [String], default: DEFAULT_STATUSES },
  },
  { timestamps: true }
);

export default mongoose.models.InventoryConfig ||
  mongoose.model<IInventoryConfig>('InventoryConfig', InventoryConfigSchema);


