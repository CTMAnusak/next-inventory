/*
 * Quick verification script
 * - Aggregates InventoryItem by categoryId
 * - Checks for any legacy 'category' field usage
 */

import dbConnect from '../lib/mongodb';
import InventoryItem from '../models/InventoryItem';

async function main() {
  await dbConnect();

  const grouped = await InventoryItem.aggregate([
    { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  const legacyCategoryField = await InventoryItem.collection.countDocuments({ category: { $exists: true } });
  const simByRefId = await InventoryItem.collection.countDocuments({ categoryId: 'cat_sim_card' });
  const simByLegacyName = await InventoryItem.collection.countDocuments({ categoryId: 'ซิมการ์ด' });

  console.log(JSON.stringify({ grouped, checks: { legacyCategoryField, simByRefId, simByLegacyName } }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });


