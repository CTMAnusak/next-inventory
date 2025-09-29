import fs from 'fs';
import path from 'path';
import InventoryConfig from '@/models/InventoryConfig';
import { ICategoryConfig } from '@/models/InventoryConfig';

interface BackupData {
  timestamp: string;
  categoryConfigs: ICategoryConfig[];
  statuses: string[];
  version: string;
}

/**
 * Creates a rotating backup system with only 2 files:
 * - inventory-config-current.json (latest)
 * - inventory-config-previous.json (previous version for rollback)
 */
export async function createRotatingBackup(): Promise<void> {
  try {
    const currentConfig = await InventoryConfig.findOne({});
    if (!currentConfig) {
      console.warn('⚠️  No inventory config found for backup');
      return;
    }

    const backupDir = path.join(process.cwd(), 'src', 'backups');
    
    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const currentFile = path.join(backupDir, 'inventory-config-current.json');
    const previousFile = path.join(backupDir, 'inventory-config-previous.json');
    
    // Rotate: current → previous (if current exists)
    if (fs.existsSync(currentFile)) {
      if (fs.existsSync(previousFile)) {
        fs.unlinkSync(previousFile); // Remove old previous
      }
      fs.renameSync(currentFile, previousFile); // Move current to previous
    }
    
    // Create new current backup
    const backupData: BackupData = {
      timestamp: new Date().toISOString(),
      categoryConfigs: currentConfig.categoryConfigs || [],
      statuses: currentConfig.statuses || [],
      version: '1.0.0'
    };
    
    fs.writeFileSync(currentFile, JSON.stringify(backupData, null, 2));
    
  } catch (error) {
    console.error('❌ Error creating rotating backup:', error);
    throw error;
  }
}

/**
 * Restores configuration from the previous backup file
 */
export async function rollbackFromBackup(): Promise<void> {
  try {
    const backupDir = path.join(process.cwd(), 'src', 'backups');
    const previousFile = path.join(backupDir, 'inventory-config-previous.json');
    
    if (!fs.existsSync(previousFile)) {
      throw new Error('No previous backup file found for rollback');
    }
    
    const backupData: BackupData = JSON.parse(fs.readFileSync(previousFile, 'utf8'));
    
    const config = await InventoryConfig.findOne({});
    if (!config) {
      throw new Error('No inventory config found to rollback');
    }
    
    // Restore from backup
    config.categoryConfigs = backupData.categoryConfigs;
    config.statuses = backupData.statuses;
    await config.save();
    
  } catch (error) {
    console.error('❌ Error during rollback:', error);
    throw error;
  }
}

/**
 * Gets backup information without loading the full data
 */
export function getBackupInfo(): { current: BackupData | null; previous: BackupData | null } {
  const backupDir = path.join(process.cwd(), 'src', 'backups');
  const currentFile = path.join(backupDir, 'inventory-config-current.json');
  const previousFile = path.join(backupDir, 'inventory-config-previous.json');
  
  let current: BackupData | null = null;
  let previous: BackupData | null = null;
  
  try {
    if (fs.existsSync(currentFile)) {
      current = JSON.parse(fs.readFileSync(currentFile, 'utf8'));
    }
  } catch (error) {
    console.warn('⚠️  Error reading current backup:', error);
  }
  
  try {
    if (fs.existsSync(previousFile)) {
      previous = JSON.parse(fs.readFileSync(previousFile, 'utf8'));
    }
  } catch (error) {
    console.warn('⚠️  Error reading previous backup:', error);
  }
  
  return { current, previous };
}

/**
 * Clears all backup files (use with caution!)
 */
export function clearAllBackups(): void {
  const backupDir = path.join(process.cwd(), 'src', 'backups');
  const currentFile = path.join(backupDir, 'inventory-config-current.json');
  const previousFile = path.join(backupDir, 'inventory-config-previous.json');
  
  if (fs.existsSync(currentFile)) {
    fs.unlinkSync(currentFile);
  }
  
  if (fs.existsSync(previousFile)) {
    fs.unlinkSync(previousFile);
  }
  
}
