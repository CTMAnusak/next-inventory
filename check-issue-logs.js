const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/inventory').then(async () => {
  console.log('Connected to MongoDB');
  
  const IssueLog = mongoose.model('IssueLog', new mongoose.Schema({}, {strict: false}));
  
  console.log('\n📊 Checking IssueLog documents...\n');
  
  const docs = await IssueLog.find({}).sort({ reportDate: -1 }).limit(10).exec();
  
  console.log(`Found ${docs.length} documents\n`);
  
  docs.forEach((doc, index) => {
    console.log(`--- Issue ${index + 1} ---`);
    console.log('issueId:', doc.issueId);
    console.log('requesterId:', doc.requesterId);
    console.log('requesterType:', doc.requesterType);
    console.log('firstName:', doc.firstName);
    console.log('lastName:', doc.lastName);
    console.log('nickname:', doc.nickname);
    console.log('phone:', doc.phone);
    console.log('email:', doc.email);
    console.log('department:', doc.department);
    console.log('office:', doc.office);
    console.log('reportDate:', doc.reportDate);
    console.log('');
  });
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

