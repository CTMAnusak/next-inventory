// ทดสอบระบบ Snapshot โดยการตรวจสอบข้อมูลในฐานข้อมูล
const mongoose = require('mongoose');

async function checkSnapshotData() {
  try {
    // เชื่อมต่อฐานข้อมูล
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory');
    console.log('🔗 Connected to MongoDB');

    // ตรวจสอบ DeletedUsers
    const DeletedUsers = mongoose.model('DeletedUsers', new mongoose.Schema({}, { strict: false }));
    const deletedUsers = await DeletedUsers.find({});
    console.log('\n📸 DeletedUsers Collection:');
    console.log('Count:', deletedUsers.length);
    deletedUsers.forEach(user => {
      console.log(`- ${user.user_id}: ${user.firstName} ${user.lastName} (${user.userType})`);
    });

    // ตรวจสอบ IssueLog
    const IssueLog = mongoose.model('IssueLog', new mongoose.Schema({}, { strict: false }));
    const issueLogs = await IssueLog.find({}).limit(5);
    console.log('\n📋 IssueLog Collection (first 5):');
    issueLogs.forEach(issue => {
      console.log(`- ${issue.issueId}: ${issue.firstName || 'N/A'} ${issue.lastName || 'N/A'} (${issue.description?.substring(0, 50)}...)`);
    });

    // ตรวจสอบ RequestLog
    const RequestLog = mongoose.model('RequestLog', new mongoose.Schema({}, { strict: false }));
    const requestLogs = await RequestLog.find({}).limit(5);
    console.log('\n📦 RequestLog Collection (first 5):');
    requestLogs.forEach(req => {
      console.log(`- ${req.requestId}: ${req.firstName || 'N/A'} ${req.lastName || 'N/A'} (${req.itemName})`);
    });

    // ตรวจสอบ ReturnLog
    const ReturnLog = mongoose.model('ReturnLog', new mongoose.Schema({}, { strict: false }));
    const returnLogs = await ReturnLog.find({}).limit(5);
    console.log('\n🔄 ReturnLog Collection (first 5):');
    returnLogs.forEach(ret => {
      console.log(`- ${ret.returnId}: ${ret.firstName || 'N/A'} ${ret.lastName || 'N/A'} (${ret.itemName})`);
    });

    // ตรวจสอบ User collection
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const users = await User.find({}).limit(5);
    console.log('\n👥 User Collection (first 5):');
    users.forEach(user => {
      console.log(`- ${user.user_id}: ${user.firstName} ${user.lastName} (${user.userType})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkSnapshotData();
