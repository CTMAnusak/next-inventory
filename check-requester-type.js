const mongoose = require('mongoose');

async function checkIssueLogRequesterType() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory');
    console.log('🔗 Connected to MongoDB');

    const IssueLog = mongoose.model('IssueLog', new mongoose.Schema({}, { strict: false }));
    
    // ตรวจสอบ IssueLog ทั้งหมด
    const issues = await IssueLog.find({}).sort({ reportDate: -1 }).limit(10);
    
    console.log('\n📋 IssueLog Data (checking requesterType):');
    issues.forEach((issue, index) => {
      console.log(`\n--- Issue ${index + 1} ---`);
      console.log('Issue ID:', issue.issueId);
      console.log('Requester ID:', issue.requesterId);
      console.log('Requester Type:', issue.requesterType || 'NOT SET ❌');
      console.log('First Name:', issue.firstName);
      console.log('Last Name:', issue.lastName);
    });

    // นับจำนวนที่มี requesterType และไม่มี
    const withType = await IssueLog.countDocuments({ requesterType: { $exists: true, $ne: null } });
    const withoutType = await IssueLog.countDocuments({ $or: [{ requesterType: { $exists: false } }, { requesterType: null }] });
    
    console.log('\n📊 Statistics:');
    console.log('- Issues WITH requesterType:', withType);
    console.log('- Issues WITHOUT requesterType:', withoutType);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkIssueLogRequesterType();
