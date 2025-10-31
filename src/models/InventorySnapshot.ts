import mongoose, { Document, Schema } from 'mongoose';

export interface IInventorySnapshot extends Document {
  year: number;              // ปี (เช่น 2568)
  month: number;             // เดือน (1-12)
  snapshotDate: Date;        // วันที่สร้าง snapshot (วันสุดท้ายของเดือน)
  
  // สถิติรวม
  totalInventoryItems: number;        // จำนวนรายการทั้งหมด (sum of totalQuantity from InventoryMaster)
  totalInventoryCount: number;       // จำนวนชิ้นทั้งหมด (sum of totalQuantity)
  lowStockItems: number;             // จำนวนรายการที่ใกล้หมด (≤ 2)
  
  // ข้อมูลรายละเอียด (optional - สำหรับเก็บข้อมูลรายละเอียดของแต่ละ item)
  itemDetails?: Array<{
    itemName: string;
    categoryId: string;
    totalQuantity: number;
    availableQuantity: number;
    userOwnedQuantity: number;
    isLowStock: boolean;  // availableQuantity ≤ 2
  }>;
  
  createdAt: Date;
  updatedAt: Date;
}

const InventorySnapshotSchema = new Schema<IInventorySnapshot>({
  year: {
    type: Number,
    required: true,
    index: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
    index: true
  },
  snapshotDate: {
    type: Date,
    required: true,
    index: true
  },
  totalInventoryItems: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  totalInventoryCount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  lowStockItems: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  itemDetails: [{
    itemName: {
      type: String,
      required: true
    },
    categoryId: {
      type: String,
      required: true
    },
    totalQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    availableQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    userOwnedQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    isLowStock: {
      type: Boolean,
      default: false
    }
  }]
}, {
  timestamps: true
});

// Unique index สำหรับ year + month (ไม่ให้มี snapshot ซ้ำในปีและเดือนเดียวกัน)
// ถ้าสร้าง snapshot สำหรับเดือนเดียวกันแต่ปีต่างกัน จะสร้างเป็นรายการใหม่ได้
// ถ้าสร้าง snapshot สำหรับปีและเดือนเดียวกัน จะอัพเดตทับข้อมูลเดิม
InventorySnapshotSchema.index({ year: 1, month: 1 }, { unique: true });

// Index สำหรับค้นหาอย่างรวดเร็ว
InventorySnapshotSchema.index({ snapshotDate: -1 });

export default mongoose.models.InventorySnapshots || mongoose.model<IInventorySnapshot>('InventorySnapshots', InventorySnapshotSchema);

