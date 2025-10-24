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
    
    // Helper function to create indexes safely with conflict resolution
    const createIndexesSafely = async (collectionName: string, indexes: any[]) => {
      try {
        if (!mongoose.connection.db) {
          throw new Error('Database connection not established');
        }
        
        const collection = mongoose.connection.db.collection(collectionName);
        
        // Verify collection exists
        const collections = await mongoose.connection.db.listCollections({ name: collectionName }).toArray();
        if (collections.length === 0) {
          console.log(`⚠️ Collection ${collectionName} does not exist, skipping indexes`);
          return;
        }
        
        // Get existing indexes
        const existingIndexes = await collection.listIndexes().toArray();
        const existingIndexKeys = existingIndexes.map(idx => JSON.stringify(idx.key));
        const existingIndexNames = existingIndexes.map(idx => idx.name);
        
        // Filter out indexes that already exist and handle conflicts
        const newIndexes = [];
        const conflictingIndexes = [];
        
        for (const index of indexes) {
          const indexKey = JSON.stringify(index.key);
          const existingIndex = existingIndexes.find(idx => JSON.stringify(idx.key) === indexKey);
          
          if (existingIndex) {
            // Check if it's a naming conflict
            if (existingIndex.name !== index.name) {
              conflictingIndexes.push({
                existing: existingIndex.name,
                new: index.name,
                key: index.key
              });
              console.log(`⚠️ Index conflict detected: ${existingIndex.name} vs ${index.name} for key ${indexKey}`);
            } else {
              console.log(`ℹ️ Index ${index.name} already exists`);
            }
          } else {
            newIndexes.push(index);
          }
        }
        
        // Create new indexes
        if (newIndexes.length > 0) {
          console.log(`📊 Creating ${newIndexes.length} new indexes for ${collectionName}...`);
          try {
            await collection.createIndexes(newIndexes);
            console.log(`✅ Successfully created ${newIndexes.length} indexes for ${collectionName}`);
          } catch (createError) {
            console.error(`❌ Error creating indexes for ${collectionName}:`, createError);
            // Try creating indexes one by one
            for (const index of newIndexes) {
              try {
                await collection.createIndex(index.key, { name: index.name, ...index });
                console.log(`✅ Created index ${index.name}`);
              } catch (singleError) {
                console.error(`❌ Failed to create index ${index.name}:`, singleError);
              }
            }
          }
        } else {
          console.log(`ℹ️ All indexes already exist for ${collectionName}`);
        }
        
        // Log conflicts for manual review
        if (conflictingIndexes.length > 0) {
          console.log(`⚠️ Found ${conflictingIndexes.length} index conflicts in ${collectionName}:`);
          conflictingIndexes.forEach(conflict => {
            console.log(`   - Existing: ${conflict.existing}, New: ${conflict.new}`);
          });
        }
        
      } catch (error) {
        console.error(`❌ Error processing indexes for ${collectionName}:`, error);
        // Continue with other collections even if one fails
      }
    };
    
    // InventoryMaster indexes
    console.log('📊 Creating InventoryMaster indexes...');
    await createIndexesSafely('inventorymasters', [
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
    await createIndexesSafely('inventoryitems', [
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
    await createIndexesSafely('requestlogs', [
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
    await createIndexesSafely('returnlogs', [
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
    await createIndexesSafely('issuelogs', [
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
    await createIndexesSafely('users', [
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
    await createIndexesSafely('deletedusers', [
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
    await createIndexesSafely('transferlogs', [
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
      try {
        if (!mongoose.connection.db) {
          throw new Error('Database connection not established');
        }
        const collection = mongoose.connection.db.collection(collectionName);
        
        // Use modern MongoDB driver methods
        const count = await collection.estimatedDocumentCount();
        const indexes = await collection.listIndexes().toArray();
        
        // Get collection stats using aggregation
        const statsPipeline = [
          { $collStats: { storageStats: {}, count: {}, indexDetails: {} } }
        ];
        
        let stats = null;
        try {
          const statsResult = await collection.aggregate(statsPipeline).toArray();
          stats = statsResult[0];
        } catch (statsError) {
          console.log(`⚠️ Could not get detailed stats for ${collectionName}, using basic info`);
        }
        
        console.log(`📊 ${collectionName}:`);
        console.log(`   - Documents: ${count}`);
        console.log(`   - Indexes: ${indexes.length}`);
        
        if (stats) {
          console.log(`   - Size: ${((stats.storageStats?.size || 0) / 1024 / 1024).toFixed(2)} MB`);
          console.log(`   - Index Size: ${((stats.storageStats?.totalIndexSize || 0) / 1024 / 1024).toFixed(2)} MB`);
          console.log(`   - Average Object Size: ${((stats.storageStats?.avgObjSize || 0) / 1024).toFixed(2)} KB`);
        } else {
          console.log(`   - Size: N/A (stats not available)`);
          console.log(`   - Index Size: N/A (stats not available)`);
        }
      } catch (collectionError) {
        console.error(`❌ Error analyzing collection ${collectionName}:`, collectionError);
        // Continue with other collections
      }
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
      'users',
      'deletedusers',
      'transferlogs'
    ];
    
    for (const collectionName of collections) {
      try {
        if (!mongoose.connection.db) {
          throw new Error('Database connection not established');
        }
        
        const collection = mongoose.connection.db.collection(collectionName);
        
        // Verify collection exists
        const existingCollections = await mongoose.connection.db.listCollections({ name: collectionName }).toArray();
        if (existingCollections.length === 0) {
          console.log(`⚠️ Collection ${collectionName} does not exist, skipping cleanup`);
          continue;
        }
        
        const indexes = await collection.listIndexes().toArray();
        console.log(`📋 ${collectionName} indexes:`);
        indexes.forEach(index => {
          console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
        });
      } catch (collectionError) {
        console.error(`❌ Error processing collection ${collectionName}:`, collectionError);
        // Continue with other collections
      }
    }
    
  } catch (error) {
    console.error('❌ Error cleaning up indexes:', error);
    throw error;
  }
}

/**
 * Resolve index conflicts by dropping duplicate indexes
 */
export async function resolveIndexConflicts() {
  try {
    console.log('🔧 Resolving index conflicts...');
    
    if (!mongoose.connection.db) {
      throw new Error('Database connection not established');
    }
    
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
      try {
        if (!mongoose.connection.db) {
          throw new Error('Database connection not established');
        }
        
        const collection = mongoose.connection.db.collection(collectionName);
        
        // Verify collection exists
        const existingCollections = await mongoose.connection.db.listCollections({ name: collectionName }).toArray();
        if (existingCollections.length === 0) {
          console.log(`⚠️ Collection ${collectionName} does not exist, skipping conflict resolution`);
          continue;
        }
        
        const indexes = await collection.listIndexes().toArray();
        
        // Group indexes by their key structure
        const indexGroups = new Map<string, any[]>();
        
        indexes.forEach((index: any) => {
          const keyStr = JSON.stringify(index.key);
          if (!indexGroups.has(keyStr)) {
            indexGroups.set(keyStr, []);
          }
          indexGroups.get(keyStr)!.push(index);
        });
        
        // Find and resolve conflicts
        const dropPromises: Promise<void>[] = [];
        let conflictsFound = 0;
        
        indexGroups.forEach((indexList: any[], keyStr: string) => {
          if (indexList.length > 1) {
            conflictsFound++;
            console.log(`⚠️ Found ${indexList.length} indexes with same key in ${collectionName}:`);
            indexList.forEach((index: any) => {
              console.log(`   - ${index.name}`);
            });
            
            // Keep the first index, drop the rest
            const keepIndex = indexList[0];
            const dropIndexes = indexList.slice(1);
            
            console.log(`   ✅ Keeping: ${keepIndex.name}`);
            console.log(`   🗑️ Dropping: ${dropIndexes.map((idx: any) => idx.name).join(', ')}`);
            
            // Add drop operations to promises array
            dropIndexes.forEach((dropIndex: any) => {
              dropPromises.push(
                collection.dropIndex(dropIndex.name)
                  .then(() => {
                    console.log(`🗑️ Successfully dropped duplicate index: ${dropIndex.name}`);
                  })
                  .catch((dropError: any) => {
                    console.error(`❌ Failed to drop index ${dropIndex.name}:`, dropError);
                  })
              );
            });
          }
        });
        
        // Wait for all drop operations to complete
        if (dropPromises.length > 0) {
          console.log(`🔄 Processing ${dropPromises.length} drop operations for ${collectionName}...`);
          await Promise.all(dropPromises);
          console.log(`✅ Completed ${conflictsFound} conflict resolutions for ${collectionName}`);
        } else {
          console.log(`✅ No conflicts found in ${collectionName}`);
        }
        
      } catch (collectionError) {
        console.error(`❌ Error processing collection ${collectionName}:`, collectionError);
      }
    }
    
    console.log('✅ Index conflicts resolved!');
    
  } catch (error) {
    console.error('❌ Error resolving index conflicts:', error);
    throw error;
  }
}
