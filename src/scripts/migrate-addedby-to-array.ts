import dbConnect from '@/lib/mongodb';
import Inventory from '@/models/Inventory';
import mongoose from 'mongoose';

/**
 * Migration script to convert addedBy from string to array
 * and merge duplicate items with same itemName and category
 */
async function migrateAddedByToArray() {
  try {
    await dbConnect();

    // Get all inventory items
    const allItems = await Inventory.find({}).lean();

    // Group items by itemName + category
    const itemGroups = new Map();
    
    for (const item of allItems) {
      const key = `${item.itemName}||${item.categoryId}`;
      
      if (!itemGroups.has(key)) {
        itemGroups.set(key, []);
      }
      itemGroups.get(key).push(item);
    }


    let mergedCount = 0;
    let updatedCount = 0;

    for (const [key, items] of itemGroups) {
      if (items.length === 1) {
        // Single item - just convert addedBy to new structure
        const item = items[0];
        const addedByArray = [];
        
        if (typeof item.addedBy === 'string') {
          const role = item.addedBy;
          const userId = item.user_id || 'unknown';
          const quantity = item.quantity || item.totalQuantity || 1;
          addedByArray.push({ 
            role, 
            userId, 
            quantity,
            dateAdded: item.dateAdded || new Date()
          });
        } else if (Array.isArray(item.addedBy)) {
          item.addedBy.forEach((entry: any) => {
            if (typeof entry === 'string') {
              const role = entry;
              const userId = item.user_id || 'unknown';
              const quantity = item.quantity || item.totalQuantity || 1;
              addedByArray.push({ 
                role, 
                userId, 
                quantity,
                dateAdded: item.dateAdded || new Date()
              });
            } else if (entry && entry.role && entry.userId) {
              // Already in new format, but ensure quantity and dateAdded exist
              addedByArray.push({ 
                role: entry.role, 
                userId: entry.userId,
                quantity: entry.quantity || item.quantity || 1,
                dateAdded: entry.dateAdded || item.dateAdded || new Date()
              });
            }
          });
        }

                 await Inventory.findByIdAndUpdate(item._id, {
           addedBy: addedByArray,
           $unset: { user_id: "", userRole: "" } // Remove legacy fields
         });
        
        updatedCount++;
      } else {
        // Multiple items - merge them
        
        // Find the best item to keep (prefer admin-added, then newest)
        const sortedItems = items.sort((a: any, b: any) => {
          // Prefer admin-added items
          const aIsAdmin = (typeof a.addedBy === 'string' && a.addedBy === 'admin') || 
                          (Array.isArray(a.addedBy) && a.addedBy.includes('admin'));
          const bIsAdmin = (typeof b.addedBy === 'string' && b.addedBy === 'admin') || 
                          (Array.isArray(b.addedBy) && b.addedBy.includes('admin'));
          
          if (aIsAdmin && !bIsAdmin) return -1;
          if (!aIsAdmin && bIsAdmin) return 1;
          
          // If both or neither are admin, prefer newest
          return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
        });

        const primaryItem = sortedItems[0];
        const itemsToMerge = sortedItems.slice(1);

        // Collect all addedBy values with detailed structure
        const addedByMap = new Map();
        let totalQuantity = 0;
        let totalAdminQuantity = 0;

        for (const item of items) {
          // Handle different addedBy formats
          if (typeof item.addedBy === 'string') {
            // Old format: just role
            const role = item.addedBy;
            const userId = item.user_id || 'unknown';
            const quantity = item.quantity || item.totalQuantity || 1;
            addedByMap.set(`${role}-${userId}`, { 
              role, 
              userId, 
              quantity,
              dateAdded: item.dateAdded || new Date()
            });
          } else if (Array.isArray(item.addedBy)) {
            // New format or mixed
            item.addedBy.forEach((entry: any) => {
              if (typeof entry === 'string') {
                // Still old format in array
                const role = entry;
                const userId = item.user_id || 'unknown';
                const quantity = item.quantity || item.totalQuantity || 1;
                addedByMap.set(`${role}-${userId}`, { 
                  role, 
                  userId, 
                  quantity,
                  dateAdded: item.dateAdded || new Date()
                });
              } else if (entry && entry.role && entry.userId) {
                // New format
                addedByMap.set(`${entry.role}-${entry.userId}`, { 
                  role: entry.role, 
                  userId: entry.userId,
                  quantity: entry.quantity || item.quantity || 1,
                  dateAdded: entry.dateAdded || item.dateAdded || new Date()
                });
              }
            });
          }

          // Sum quantities
          totalQuantity += (item.totalQuantity || item.quantity || 0);
          
                   // Sum warehouse quantities (available for requests)
         if (item.addedBy && (
           (typeof item.addedBy === 'string' && item.addedBy === 'admin') || 
           (Array.isArray(item.addedBy) && (
             item.addedBy.includes('admin') || 
             item.addedBy.some((entry: any) => entry.role === 'admin')
           ))
         )) {
           totalAdminQuantity += (item.quantity || 0);
         }
        }

                 // Update primary item with merged data
         await Inventory.findByIdAndUpdate(primaryItem._id, {
           addedBy: Array.from(addedByMap.values()),
           totalQuantity: totalQuantity,
           quantity: totalAdminQuantity,
           dateAdded: new Date(), // Update to current time
           $unset: { user_id: "", userRole: "" } // Remove legacy fields
         });

        // Delete the other items
        for (const item of itemsToMerge) {
          await Inventory.findByIdAndDelete(item._id);
        }

        mergedCount += itemsToMerge.length;
      }
    }

    console.log(`   - Single items updated: ${updatedCount}`);
    console.log(`   - Items merged and deleted: ${mergedCount}`);
    console.log(`   - Final unique items: ${itemGroups.size}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateAddedByToArray()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

export default migrateAddedByToArray;
