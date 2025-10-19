const mongoose = require('mongoose');

async function checkIssueLogData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory');
    console.log('🔗 Connected to MongoDB');

    const IssueLog = mongoose.model('IssueLog', new mongoose.Schema({}, { strict: false }));
    
    // ตรวจสอบ IssueLog ที่มี requesterId เดียวกัน
    const issues = await IssueLog.find({}).sort({ reportDate: -1 }).limit(5);
    
    console.log('\n📋 IssueLog Data:');
    issues.forEach((issue, index) => {
      console.log(`\n--- Issue ${index + 1} ---`);
      console.log('Issue ID:', issue.issueId);
      console.log('Requester ID:', issue.requesterId);
      console.log('Requester Type:', issue.requesterType);
      console.log('First Name:', issue.firstName);
      console.log('Last Name:', issue.lastName);
      console.log('Nickname:', issue.nickname);
      console.log('Phone:', issue.phone);
      console.log('Email:', issue.email);
      console.log('Department:', issue.department);
      console.log('Office:', issue.office);
    });

    // ตรวจสอบ DeletedUsers
    const DeletedUsers = mongoose.model('DeletedUsers', new mongoose.Schema({}, { strict: false }));
    const deletedUsers = await DeletedUsers.find({});
    
    console.log('\n📸 DeletedUsers Data:');
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
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkIssueLogData();
