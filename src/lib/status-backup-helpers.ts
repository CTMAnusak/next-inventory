import fs from 'fs';
import path from 'path';
import dbConnect from '@/lib/mongodb';
import InventoryConfig, { IStatusConfig } from '@/models/InventoryConfig';

// Status backup data structure
interface StatusBackupData {
  timestamp: string;
  statusConfigs: IStatusConfig[];
  version: string;
}

// ✅ Backup แค่ 2 ไฟล์ตามที่ต้องการ
const BACKUP_DIR = path.join(process.cwd(), 'src', 'backups');
const CURRENT_BACKUP_FILE = path.join(BACKUP_DIR, 'status-configs-current.json');
const PREVIOUS_BACKUP_FILE = path.join(BACKUP_DIR, 'status-configs-previous.json');

/**
 * สร้าง backup สำหรับ statusConfigs
 * เก็บแค่ 2 ไฟล์: current และ previous
 */
export async function createStatusBackup(): Promise<void> {
  try {
    await dbConnect();
    
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    // Get current config
    const config = await InventoryConfig.findOne({});
    if (!config) {
      return;
    }
    
    // ถ้ามี current backup อยู่แล้ว ย้ายไปเป็น previous
    if (fs.existsSync(CURRENT_BACKUP_FILE)) {
      const currentData = fs.readFileSync(CURRENT_BACKUP_FILE, 'utf8');
      fs.writeFileSync(PREVIOUS_BACKUP_FILE, currentData);
    }
    
    // สร้าง current backup ใหม่
    const backupData: StatusBackupData = {
      timestamp: new Date().toISOString(),
      statusConfigs: config.statusConfigs || [],
      version: '1.0.0'
    };
    
    fs.writeFileSync(CURRENT_BACKUP_FILE, JSON.stringify(backupData, null, 2));
    
  } catch (error) {
    console.error('❌ Error creating status backup:', error);
    throw error;
  }
}

/**
 * คืนค่าข้อมูลจาก backup
 */
export async function restoreStatusFromBackup(usePrevious: boolean = false): Promise<void> {
  try {
    await dbConnect();
    
    const backupFile = usePrevious ? PREVIOUS_BACKUP_FILE : CURRENT_BACKUP_FILE;
    const backupType = usePrevious ? 'previous' : 'current';
    
    if (!fs.existsSync(backupFile)) {
      throw new Error(`❌ ${backupType} backup file not found: ${backupFile}`);
    }
    
    const backupData: StatusBackupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    
    // Get or create config
    let config = await InventoryConfig.findOne({});
    if (!config) {
      throw new Error('❌ No inventory config found in database');
    }
    
    // Restore from backup
    config.statusConfigs = backupData.statusConfigs;
    await config.save();
    
  } catch (error) {
    console.error('❌ Error during status restore:', error);
    throw error;
  }
}

/**
 * ลิสต์ backup ที่มีอยู่
 */
export function listStatusBackups(): Array<{ type: string; file: string; exists: boolean; timestamp?: string; count?: number }> {
  const backups = [
    { type: 'current', file: CURRENT_BACKUP_FILE },
    { type: 'previous', file: PREVIOUS_BACKUP_FILE }
  ];
  
  return backups.map(backup => {
    const exists = fs.existsSync(backup.file);
    let timestamp: string | undefined;
    let count: number | undefined;
    
    if (exists) {
      try {
        const data: StatusBackupData = JSON.parse(fs.readFileSync(backup.file, 'utf8'));
        timestamp = data.timestamp;
        count = data.statusConfigs.length;
      } catch (error) {
        console.error(`Error reading backup ${backup.type}:`, error);
      }
    }
    
    return {
      type: backup.type,
      file: backup.file,
      exists,
      timestamp,
      count
    };
  });
}

/**
 * เช็คว่ามี backup หรือไม่
 */
export function hasStatusBackups(): boolean {
  return fs.existsSync(CURRENT_BACKUP_FILE) || fs.existsSync(PREVIOUS_BACKUP_FILE);
}

/**
 * ลบ backup ทั้งหมด (ใช้เมื่อไม่ต้องการ backup แล้ว)
 */
export function clearStatusBackups(): void {
  try {
    if (fs.existsSync(CURRENT_BACKUP_FILE)) {
      fs.unlinkSync(CURRENT_BACKUP_FILE);
    }
    
    if (fs.existsSync(PREVIOUS_BACKUP_FILE)) {
      fs.unlinkSync(PREVIOUS_BACKUP_FILE);
    }
    
  } catch (error) {
    console.error('❌ Error clearing status backups:', error);
    throw error;
  }
}
