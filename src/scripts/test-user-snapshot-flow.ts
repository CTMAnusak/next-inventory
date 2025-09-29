import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import User from '@/models/User';
import RequestLog from '@/models/RequestLog';
import DeletedUsers from '@/models/DeletedUser';

async function resolveUserByUserId(userBusinessId: string) {
  const active = await User.findOne({ user_id: userBusinessId })
    .select('firstName lastName nickname department office phone user_id');
  if (active) {
    return { source: 'User', data: active };
  }
  const snap = await DeletedUsers.findOne({ user_id: userBusinessId })
    .select('firstName lastName nickname department office phone user_id');
  if (snap) {
    return { source: 'DeletedUsers', data: snap };
  }
  return { source: 'Unknown', data: null };
}

async function run() {
  const { default: dbConnect } = await import('@/lib/mongodb');
  await dbConnect();

  const stamp = Date.now();
  const userBusinessId = `TEST_USER_${stamp}`;

  // 1) Create user
  const u = await User.create({
    user_id: userBusinessId,
    firstName: 'Test',
    lastName: 'Snapshot',
    nickname: 'TSS',
    department: 'IT',
    office: 'HQ',
    phone: '080-000-0000',
    email: `tss_${stamp}@example.com`,
    registrationMethod: 'manual',
    userType: 'individual',
    userRole: 'user',
    isApproved: true
  });

  // 2) Create request log (simulate request)
  const r = await RequestLog.create({
    userId: userBusinessId,
    requestDate: new Date(),
    urgency: 'normal',
    deliveryLocation: 'HQ',
    items: [],
    status: 'pending',
    requestType: 'request'
  });

  // 3) Resolve before deletion (should come from User)
  let res1 = await resolveUserByUserId(userBusinessId);
  console.log('Before deletion -> source:', res1.source, 'name:', res1.data?.firstName, res1.data?.lastName);

  // 4) Snapshot then delete user (simulate API delete path)
  await DeletedUsers.findOneAndUpdate(
    { userMongoId: u._id.toString() },
    {
      userMongoId: u._id.toString(),
      user_id: u.user_id,
      firstName: u.firstName,
      lastName: u.lastName,
      nickname: u.nickname,
      department: u.department,
      office: u.office,
      phone: u.phone,
      email: u.email,
      deletedAt: new Date()
    },
    { upsert: true, new: true }
  );
  await User.findByIdAndDelete(u._id);

  // 5) Resolve after deletion (should come from DeletedUsers)
  let res2 = await resolveUserByUserId(userBusinessId);
  console.log('After deletion  -> source:', res2.source, 'name:', res2.data?.firstName, res2.data?.lastName);

  // Output quick assertion
  if (res1.source === 'User' && res2.source === 'DeletedUsers') {
    console.log('✅ Snapshot fallback works.');
  } else {
    console.log('❌ Snapshot fallback did not behave as expected. Got:', res1.source, '->', res2.source);
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });


