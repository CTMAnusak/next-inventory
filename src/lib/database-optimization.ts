import mongoose from 'mongoose';

/**
 * Database Performance Optimization Script
 * เพิ่ม indexes ที่จำเป็นเพื่อปรับปรุงประสิทธิภาพการ query
 */

export async function createPerformanceIndexes() {
  try {
    console.log('🚀 Starting database performance optimization...');
    
    if (!mongoose.connection.db) {
      throw new Error('Database connection not established');
    }
    
    // InventoryMaster indexes
    console.log('📊 Creating InventoryMaster indexes...');
    await mongoose.connection.db.collection('inventorymasters').createIndexes([
      // Compound index for pagination and filtering
      { 
        key: { 
          totalQuantity: 1, 
          availableQuantity: 1, 
          userOwnedQuantity: 1,
          lastUpdated: -1 
        },
        name: 'quantity_status_date_idx'
      },
      // Text index for search
      { 
        key: { itemName: 'text' },
        name: 'item_name_text_idx'
      },
      // Category filter index
      { 
        key: { categoryId: 1, lastUpdated: -1 },
        name: 'category_date_idx'
      },
      // Performance index for admin inventory queries
      { 
        key: { 
          itemName: 1, 
          categoryId: 1, 
          lastUpdated: -1 
        },
        name: 'admin_inventory_query_idx'
      },
      // Low stock items index
      { 
        key: { 
          availableQuantity: 1, 
          totalQuantity: 1 
        },
        name: 'low_stock_idx'
      }
    ]);
    
    // InventoryItem indexes
    console.log('📦 Creating InventoryItem indexes...');
    await mongoose.connection.db.collection('inventoryitems').createIndexes([
      // Compound index for user ownership queries
      { 
        key: { 
          'currentOwnership.ownerType': 1,
          'currentOwnership.userId': 1,
          deletedAt: 1
        },
        name: 'ownership_type_user_deleted_idx'
      },
      // Item name and category compound index
      { 
        key: { itemName: 1, categoryId: 1 },
        name: 'item_category_idx'
      },
      // Serial number index (sparse)
      { 
        key: { serialNumber: 1 },
        name: 'serial_number_idx',
        sparse: true
      },
      // Phone number index (sparse)
      { 
        key: { numberPhone: 1 },
        name: 'phone_number_idx',
        sparse: true
      },
      // Status and condition indexes
      { 
        key: { statusId: 1 },
        name: 'status_idx'
      },
      { 
        key: { conditionId: 1 },
        name: 'condition_idx',
        sparse: true
      }
    ]);
    
    // RequestLog indexes
    console.log('📋 Creating RequestLog indexes...');
    await mongoose.connection.db.collection('requestlogs').createIndexes([
      // Compound index for sorting and filtering
      { 
        key: { 
          requestType: 1,
          requestDate: -1,
          createdAt: -1
        },
        name: 'type_date_idx'
      },
      // Status filter index
      { 
        key: { status: 1, requestDate: -1 },
        name: 'status_date_idx'
      },
      // User filter index
      { 
        key: { userId: 1, requestDate: -1 },
        name: 'user_date_idx'
      },
      // Approved by index
      { 
        key: { approvedBy: 1 },
        name: 'approved_by_idx',
        sparse: true
      },
      // Performance index for admin equipment reports
      { 
        key: { 
          requestType: 1, 
          requestDate: -1, 
          createdAt: -1 
        },
        name: 'admin_reports_idx'
      },
      // Items array index for aggregation
      { 
        key: { 'items.itemName': 1, 'items.categoryId': 1 },
        name: 'items_name_category_idx'
      }
    ]);
    
    // ReturnLog indexes
    console.log('🔄 Creating ReturnLog indexes...');
    await mongoose.connection.db.collection('returnlogs').createIndexes([
      // Compound index for sorting
      { 
        key: { 
          returnDate: -1,
          createdAt: -1
        },
        name: 'return_date_idx'
      },
      // User filter index
      { 
        key: { userId: 1, returnDate: -1 },
        name: 'return_user_date_idx'
      },
      // Items approval status index
      { 
        key: { 'items.approvalStatus': 1, returnDate: -1 },
        name: 'return_items_approval_idx'
      }
    ]);
    
    // IssueLog indexes
    console.log('🐛 Creating IssueLog indexes...');
    await mongoose.connection.db.collection('issuelogs').createIndexes([
      // Status filter index
      { 
        key: { status: 1, createdAt: -1 },
        name: 'issue_status_date_idx'
      },
      // User filter index
      { 
        key: { requesterId: 1, createdAt: -1 },
        name: 'issue_user_date_idx'
      },
      // Urgency filter index
      { 
        key: { urgency: 1, createdAt: -1 },
        name: 'issue_urgency_date_idx'
      },
      // Performance index for dashboard queries
      { 
        key: { 
          status: 1, 
          urgency: 1, 
          createdAt: -1 
        },
        name: 'dashboard_issues_idx'
      },
      // Date range index for period queries
      { 
        key: { createdAt: -1 },
        name: 'issue_created_date_idx'
      }
    ]);
    
    // User indexes
    console.log('👥 Creating User indexes...');
    await mongoose.connection.db.collection('users').createIndexes([
      // User ID index
      { 
        key: { user_id: 1 },
        name: 'user_id_idx',
        unique: true
      },
      // Department and office filter index
      { 
        key: { department: 1, office: 1 },
        name: 'dept_office_idx'
      },
      // Pending deletion index
      { 
        key: { pendingDeletion: 1 },
        name: 'pending_deletion_idx',
        sparse: true
      },
      // Approval status index
      { 
        key: { isApproved: 1 },
        name: 'approval_status_idx'
      },
      // Phone number index
      { 
        key: { phone: 1 },
        name: 'phone_idx',
        sparse: true
      },
      // Performance index for user queries
      { 
        key: { 
          isApproved: 1, 
          pendingDeletion: 1, 
          createdAt: -1 
        },
        name: 'user_status_idx'
      },
      // Name search index
      { 
        key: { firstName: 1, lastName: 1 },
        name: 'user_name_idx'
      }
    ]);
    
    // DeletedUser indexes
    console.log('🗑️ Creating DeletedUser indexes...');
    await mongoose.connection.db.collection('deletedusers').createIndexes([
      // Original user ID index
      { 
        key: { originalUserId: 1 },
        name: 'original_user_id_idx'
      },
      // User ID index
      { 
        key: { user_id: 1 },
        name: 'deleted_user_id_idx'
      }
    ]);
    
    // TransferLog indexes
    console.log('🔄 Creating TransferLog indexes...');
    await mongoose.connection.db.collection('transferlogs').createIndexes([
      // Date sorting index
      { 
        key: { transferDate: -1 },
        name: 'transfer_date_idx'
      },
      // From user index
      { 
        key: { 'fromOwnership.userId': 1 },
        name: 'from_user_idx',
        sparse: true
      },
      // To user index
      { 
        key: { 'toOwnership.userId': 1 },
        name: 'to_user_idx',
        sparse: true
      }
    ]);
    
    console.log('✅ Database performance optimization completed!');
    console.log('📈 All performance indexes have been created successfully.');
    
  } catch (error) {
    console.error('❌ Error creating performance indexes:', error);
    throw error;
  }
}

/**
 * Analyze query performance
 */
export async function analyzeQueryPerformance() {
  try {
    console.log('🔍 Analyzing query performance...');
    
    // Get collection stats
    const collections = [
      'inventorymasters',
      'inventoryitems', 
      'requestlogs',
      'returnlogs',
      'issuelogs',
      'users',
      'deletedusers',
      'transferlogs'
    ];
    
    for (const collectionName of collections) {
      if (!mongoose.connection.db) {
        throw new Error('Database connection not established');
      }
      const collection = mongoose.connection.db.collection(collectionName);
      const stats = await (collection as any).stats();
      console.log(`📊 ${collectionName}:`);
      console.log(`   - Documents: ${stats.count}`);
      console.log(`   - Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   - Indexes: ${stats.indexes}`);
      console.log(`   - Index Size: ${(stats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`);
    }
    
  } catch (error) {
    console.error('❌ Error analyzing query performance:', error);
    throw error;
  }
}

/**
 * Drop unused indexes to save space
 */
export async function cleanupUnusedIndexes() {
  try {
    console.log('🧹 Cleaning up unused indexes...');
    
    // This would require monitoring actual query patterns
    // For now, we'll just log what indexes exist
    const collections = [
      'inventorymasters',
      'inventoryitems', 
      'requestlogs',
      'returnlogs',
      'issuelogs',
      'users'
    ];
    
    for (const collectionName of collections) {
      if (!mongoose.connection.db) {
        throw new Error('Database connection not established');
      }
      const indexes = await mongoose.connection.db.collection(collectionName).listIndexes().toArray();
      console.log(`📋 ${collectionName} indexes:`);
      indexes.forEach(index => {
        console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error cleaning up indexes:', error);
    throw error;
  }
}
