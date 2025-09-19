/**
 * Migration Script: Status String to StatusId
 * 
 * สคริปต์สำหรับการย้ายข้อมูลจาก status string เป็น statusId
 * เพื่อรองรับระบบ StatusConfig ใหม่
 */

import dbConnect from '@/lib/mongodb';
import InventoryConfig, { createStatusConfig, generateStatusId } from '@/models/InventoryConfig';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import { createStatusBackup } from '@/lib/status-backup-helpers';
import { createStatusConfigsFromStatuses } from '@/lib/status-helpers';

interface MigrationLog {
  step: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  data?: any;
}

class StatusMigrationTool {
  private logs: MigrationLog[] = [];
  
  private log(step: string, status: 'success' | 'error' | 'warning', message: string, data?: any) {
    const logEntry = { step, status, message, data };
    this.logs.push(logEntry);
    
    const emoji = status === 'success' ? '✅' : status === 'error' ? '❌' : '⚠️';
    console.log(`${emoji} [${step}] ${message}`, data ? data : '');
  }

  /**
   * Step 1: สร้าง StatusConfigs ใน Database
   */
  async createStatusConfigs(): Promise<boolean> {
    try {
      await dbConnect();
      
      // ตรวจสอบว่ามี config อยู่แล้วหรือไม่
      let config = await InventoryConfig.findOne({});
      
      if (!config) {
        this.log('create-config', 'warning', 'No inventory config found, creating new one');
        config = new InventoryConfig({
          statuses: ['active', 'maintenance', 'damaged', 'retired'],
          statusConfigs: [],
          categoryConfigs: []
        });
      }

      // ตรวจสอบว่ามี statusConfigs อยู่แล้วหรือไม่
      if (config.statusConfigs && config.statusConfigs.length > 0) {
        this.log('create-config', 'warning', 'StatusConfigs already exist, skipping creation', {
          existing: config.statusConfigs.length
        });
        return true;
      }

      // สร้าง statusConfigs จาก statuses ที่มีอยู่จริงใน DB
      const realStatuses = config.statuses || [];
      if (realStatuses.length === 0) {
        this.log('create-config', 'warning', 'No statuses found in database, skipping statusConfigs creation');
        return true;
      }
      
      const statusConfigsFromReal = createStatusConfigsFromStatuses(realStatuses);
      config.statusConfigs = statusConfigsFromReal;
      
      await config.save();
      
      this.log('create-config', 'success', 'Created status configurations from real data', {
        count: statusConfigsFromReal.length,
        configs: statusConfigsFromReal.map(c => ({ id: c.id, name: c.name })),
        originalStatuses: realStatuses
      });
      
      return true;
    } catch (error) {
      this.log('create-config', 'error', 'Failed to create status configurations', error);
      return false;
    }
  }

  /**
   * Step 2: วิเคราะห์ข้อมูลปัจจุบัน
   */
  async analyzeCurrentData(): Promise<{ statusUsage: Record<string, number>; totalItems: number }> {
    try {
      await dbConnect();
      
      // นับการใช้งาน status ในแต่ละตาราง
      const [inventoryItems, inventoryMasters] = await Promise.all([
        InventoryItem.find({}, 'status').lean(),
        InventoryMaster.find({}, 'statusBreakdown').lean()
      ]);

      const statusUsage: Record<string, number> = {};

      // วิเคราะห์จาก InventoryItem
      inventoryItems.forEach(item => {
        if (item.status) {
          statusUsage[item.status] = (statusUsage[item.status] || 0) + 1;
        }
      });

      // วิเคราะห์จาก InventoryMaster.statusBreakdown
      inventoryMasters.forEach(master => {
        if (master.statusBreakdown) {
          Object.entries(master.statusBreakdown).forEach(([status, count]) => {
            if (typeof count === 'number' && count > 0) {
              statusUsage[status] = (statusUsage[status] || 0) + count;
            }
          });
        }
      });

      const totalItems = inventoryItems.length;

      this.log('analyze', 'success', 'Data analysis completed', {
        totalItems,
        statusUsage,
        uniqueStatuses: Object.keys(statusUsage).length
      });

      return { statusUsage, totalItems };
    } catch (error) {
      this.log('analyze', 'error', 'Failed to analyze current data', error);
      return { statusUsage: {}, totalItems: 0 };
    }
  }

  /**
   * Step 3: สร้าง Status Mapping
   */
  async createStatusMapping(): Promise<Record<string, string>> {
    try {
      await dbConnect();
      
      const config = await InventoryConfig.findOne({});
      if (!config || !config.statusConfigs || config.statusConfigs.length === 0) {
        throw new Error('No status configurations found');
      }

      // สร้าง mapping จาก status string เป็น statusId
      const mapping: Record<string, string> = {
        'active': 'status_active',
        'maintenance': 'status_maintenance', 
        'damaged': 'status_damaged',
        'retired': 'status_retired',
        'deleted': 'status_deleted'
      };

      // เพิ่ม mapping สำหรับ status ที่มีอยู่ใน statusConfigs
      config.statusConfigs.forEach((statusConfig: any) => {
        const name = statusConfig.name.toLowerCase();
        
        // Map ชื่อไทยกลับไป statusId
        if (name === 'ใช้งานได้' || name === 'ปกติ') {
          mapping['active'] = statusConfig.id;
        } else if (name === 'ซ่อมบำรุง' || name === 'ซ่อม') {
          mapping['maintenance'] = statusConfig.id;
        } else if (name === 'ชำรุด' || name === 'เสียหาย') {
          mapping['damaged'] = statusConfig.id;
        } else if (name === 'เลิกใช้' || name === 'ปลดระวาง') {
          mapping['retired'] = statusConfig.id;
        }
      });

      this.log('mapping', 'success', 'Status mapping created', { mapping });
      
      return mapping;
    } catch (error) {
      this.log('mapping', 'error', 'Failed to create status mapping', error);
      return {};
    }
  }

  /**
   * Step 4: Backup ข้อมูลเดิม
   */
  async backupCurrentData(): Promise<boolean> {
    try {
      await createStatusBackup();
      this.log('backup', 'success', 'Current data backed up successfully');
      return true;
    } catch (error) {
      this.log('backup', 'error', 'Failed to backup current data', error);
      return false;
    }
  }

  /**
   * Step 5: ทำการ Migration (Dry Run)
   */
  async dryRun(): Promise<boolean> {
    try {
      const { statusUsage } = await this.analyzeCurrentData();
      const mapping = await this.createStatusMapping();

      let migrationPlan: Array<{ collection: string; field: string; updates: number }> = [];

      // ตรวจสอบ InventoryItem
      const inventoryItemCount = await InventoryItem.countDocuments({
        status: { $in: Object.keys(statusUsage) }
      });

      if (inventoryItemCount > 0) {
        migrationPlan.push({
          collection: 'InventoryItem',
          field: 'status -> statusId',
          updates: inventoryItemCount
        });
      }

      this.log('dry-run', 'success', 'Migration dry run completed', {
        migrationPlan,
        statusMapping: mapping,
        affectedRecords: inventoryItemCount
      });

      return true;
    } catch (error) {
      this.log('dry-run', 'error', 'Dry run failed', error);
      return false;
    }
  }

  /**
   * Step 6: ทำการ Migration จริง
   */
  async executeMigration(): Promise<boolean> {
    try {
      await dbConnect();
      
      const mapping = await this.createStatusMapping();
      if (Object.keys(mapping).length === 0) {
        throw new Error('No status mapping available');
      }

      let migratedCount = 0;

      // Migration InventoryItem: เพิ่ม statusId field ขณะยังคง status เก่าไว้
      const inventoryItems = await InventoryItem.find({
        status: { $in: Object.keys(mapping) }
      });

      for (const item of inventoryItems) {
        const statusId = mapping[item.status];
        if (statusId) {
          // เพิ่ม statusId field ใหม่ ยังไม่ลบ status เก่า
          await InventoryItem.updateOne(
            { _id: item._id },
            { $set: { statusId } }
          );
          migratedCount++;
        }
      }

      this.log('migration', 'success', 'Migration completed successfully', {
        migratedItems: migratedCount,
        mapping: mapping
      });

      return true;
    } catch (error) {
      this.log('migration', 'error', 'Migration failed', error);
      return false;
    }
  }

  /**
   * รัน Migration ทั้งหมด
   */
  async runFullMigration(dryRunOnly: boolean = true): Promise<MigrationLog[]> {
    console.log('🚀 Starting Status Migration Process...');
    console.log(`📋 Mode: ${dryRunOnly ? 'DRY RUN' : 'FULL MIGRATION'}`);
    
    const steps = [
      () => this.createStatusConfigs(),
      () => this.analyzeCurrentData(),
      () => this.createStatusMapping(),
      () => this.backupCurrentData(),
      () => this.dryRun()
    ];

    if (!dryRunOnly) {
      steps.push(() => this.executeMigration());
    }

    for (const step of steps) {
      const success = await step();
      if (!success) {
        this.log('migration', 'error', 'Migration stopped due to error');
        break;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.table(this.logs.map(log => ({
      Step: log.step,
      Status: log.status,
      Message: log.message
    })));

    return this.logs;
  }

  /**
   * Rollback Migration
   */
  async rollback(): Promise<boolean> {
    try {
      this.log('rollback', 'warning', 'Starting migration rollback...');
      
      // ลบ statusId field ออกจาก InventoryItem
      const result = await InventoryItem.updateMany(
        { statusId: { $exists: true } },
        { $unset: { statusId: 1 } }
      );

      this.log('rollback', 'success', 'Rollback completed', {
        removedStatusId: result.modifiedCount
      });

      return true;
    } catch (error) {
      this.log('rollback', 'error', 'Rollback failed', error);
      return false;
    }
  }
}

// Export functions for command line usage
export async function runStatusMigration(dryRun: boolean = true) {
  const migrator = new StatusMigrationTool();
  return await migrator.runFullMigration(dryRun);
}

export async function rollbackStatusMigration() {
  const migrator = new StatusMigrationTool();
  return await migrator.rollback();
}

// Command line script
if (require.main === module) {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--execute');
  const isRollback = args.includes('--rollback');

  if (isRollback) {
    rollbackStatusMigration().then(() => {
      console.log('✅ Rollback completed');
      process.exit(0);
    }).catch((error) => {
      console.error('❌ Rollback failed:', error);
      process.exit(1);
    });
  } else {
    runStatusMigration(isDryRun).then(() => {
      console.log(`✅ ${isDryRun ? 'Dry run' : 'Migration'} completed`);
      process.exit(0);
    }).catch((error) => {
      console.error(`❌ ${isDryRun ? 'Dry run' : 'Migration'} failed:`, error);
      process.exit(1);
    });
  }
}
