/**
 * Legacy Inventory Model - Deprecated
 * This file exists for backward compatibility only.
 * New code should use InventoryItem and InventoryMaster models.
 */

import InventoryMaster from './InventoryMaster';

// Export InventoryMaster as default for backward compatibility
export default InventoryMaster;

// Also export the interface for TypeScript compatibility
export interface IInventory {
  _id: string;
  itemName: string;
  category: string;
  quantity: number;
  totalQuantity: number;
  serialNumbers?: string[];
  status: string;
  dateAdded: Date;
  addedBy?: any[];
}

// Log warning when this deprecated model is used
console.warn('⚠️ WARNING: Using deprecated Inventory model. Please migrate to InventoryItem and InventoryMaster models.');
