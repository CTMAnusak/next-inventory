const mongoose = require('mongoose');

async function debugSnapshotSystem() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory');
    console.log('🔗 Connected to MongoDB');

    // 1. ตรวจสอบ IssueLog ที่มี requesterId เดียวกัน
    const IssueLog = mongoose.model('IssueLog', new mongoose.Schema({}, { strict: false }));
    const issues = await IssueLog.find({ requesterId: 'U004' }).sort({ reportDate: -1 });
    
    console.log('\n📋 IssueLog Data (requesterId: U004):');
    issues.forEach((issue, index) => {
      console.log(`\n--- Issue ${index + 1} ---`);
      console.log('Issue ID:', issue.issueId);
      console.log('Requester ID:', issue.requesterId);
      console.log('Requester Type:', issue.requesterType || 'NOT SET ❌');
      console.log('First Name:', issue.firstName);
      console.log('Last Name:', issue.lastName);
      console.log('Nickname:', issue.nickname);
      console.log('Phone:', issue.phone);
      console.log('Email:', issue.email);
      console.log('Department:', issue.department);
      console.log('Office:', issue.office);
    });

    // 2. ตรวจสอบ DeletedUsers
    const DeletedUsers = mongoose.model('DeletedUsers', new mongoose.Schema({}, { strict: false }));
    const deletedUsers = await DeletedUsers.find({ user_id: 'U004' });
    
    console.log('\n📸 DeletedUsers Data (user_id: U004):');
    deletedUsers.forEach((user, index) => {
      console.log(`\n--- Deleted User ${index + 1} ---`);
      console.log('User ID:', user.user_id);
      console.log('User Type:', user.userType);
      console.log('First Name:', user.firstName);
      console.log('Last Name:', user.lastName);
      console.log('Nickname:', user.nickname);
      console.log('Phone:', user.phone);
      console.log('Email:', user.email);
      console.log('Department:', user.department);
      console.log('Office:', user.office);
      console.log('Deleted At:', user.deletedAt);
    });

    // 3. ตรวจสอบ User collection (ถ้ายังมี)
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const users = await User.find({ user_id: 'U004' });
    
    console.log('\n👥 User Collection (user_id: U004):');
    users.forEach((user, index) => {
      console.log(`\n--- User ${index + 1} ---`);
      console.log('User ID:', user.user_id);
      console.log('User Type:', user.userType);
      console.log('First Name:', user.firstName);
      console.log('Last Name:', user.lastName);
      console.log('Nickname:', user.nickname);
      console.log('Phone:', user.phone);
      console.log('Email:', user.email);
      console.log('Department:', user.department);
      console.log('Office:', user.office);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

debugSnapshotSystem();
