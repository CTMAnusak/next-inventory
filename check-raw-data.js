const mongoose = require('mongoose');

async function checkIssueLogRawData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory');
    console.log('🔗 Connected to MongoDB');

    const IssueLog = mongoose.model('IssueLog', new mongoose.Schema({}, { strict: false }));
    
    // ตรวจสอบ IssueLog ที่มี requesterId = U004
    const issues = await IssueLog.find({ requesterId: 'U004' }).sort({ reportDate: -1 });
    
    console.log(`\n📋 Found ${issues.length} issues with requesterId: U004`);
    
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
      console.log('Report Date:', issue.reportDate);
    });

    // ตรวจสอบว่ามีข้อมูลที่แตกต่างกันหรือไม่
    const uniqueNames = new Set();
    const uniquePhones = new Set();
    
    issues.forEach(issue => {
      uniqueNames.add(`${issue.firstName} ${issue.lastName} (${issue.nickname})`);
      uniquePhones.add(issue.phone);
    });
    
    console.log(`\n📊 Analysis:`);
    console.log(`- Unique names: ${uniqueNames.size}`);
    console.log(`- Unique phones: ${uniquePhones.size}`);
    console.log(`- Total issues: ${issues.length}`);
    
    if (uniqueNames.size === 1 && uniquePhones.size === 1) {
      console.log('❌ PROBLEM: All issues have the same name and phone!');
      console.log('This means the data was already duplicated when saved to database.');
    } else {
      console.log('✅ Data is unique in database');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkIssueLogRawData();
