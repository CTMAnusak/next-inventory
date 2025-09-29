/*
  Backfill script:
  - Find RequestLogs whose userId no longer resolves to User
  - If DeletedUsers snapshot missing, create snapshot from the latest RequestLog's embedded info (if any in future),
    else skip (will remain Unknown User).
*/
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { default: dbConnect } = await import('@/lib/mongodb');
import RequestLog from '@/models/RequestLog';
import User from '@/models/User';
import DeletedUsers from '@/models/DeletedUser';

async function run() {
  await dbConnect();
  const logs = await RequestLog.find({ requestType: 'request' }).select('userId createdAt');

  let created = 0;
  for (const log of logs) {
    try {
      const user = await User.findById(log.userId);
      if (user) continue; // still exists

      const exists = await DeletedUsers.findOne({ userMongoId: log.userId });
      if (exists) continue;

      // Minimal snapshot – we don't have embedded snapshot fields today,
      // so create a stub with only ids; admin can enrich later if needed.
      await DeletedUsers.create({
        userMongoId: String(log.userId),
        deletedAt: new Date()
      });
      created++;
    } catch (e) {
      console.error('Backfill error for log', log._id, e);
    }
  }

  console.log(`Backfill completed. Created ${created} DeletedUsers snapshots.`);
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });


