const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/inventory').then(async () => {
  console.log('Connected to MongoDB\n');
  
  // Check User U003
  const user = await mongoose.connection.db.collection('users').findOne({ user_id: 'U003' });
  
  if (user) {
    console.log('👤 User U003:\n');
    console.log('User ID:', user.user_id);
    console.log('User Type:', user.userType);
    console.log('Office:', user.office);
    console.log('firstName:', user.firstName || 'N/A');
    console.log('lastName:', user.lastName || 'N/A');
    console.log('email:', user.email);
    console.log('phone:', user.phone);
    console.log('');
  } else {
    console.log('❌ User U003 not found');
  }
  
  // Check recent issuelogs with requesterId U003
  const issuelogs = await mongoose.connection.db.collection('issuelogs')
    .find({ requesterId: 'U003' })
    .sort({ reportDate: -1 })
    .limit(3)
    .toArray();
  
  console.log(`\n📋 IssueLog (U003) - ${issuelogs.length} records:\n`);
  issuelogs.forEach(issue => {
    console.log('Issue ID:', issue.issueId);
    console.log('  firstName:', issue.firstName);
    console.log('  lastName:', issue.lastName);
    console.log('  nickname:', issue.nickname);
    console.log('  phone:', issue.phone);
    console.log('  office:', issue.office);
    console.log('  department:', issue.department);
    console.log('');
  });
  
  // Check recent requestlogs with userId U003
  const requestlogs = await mongoose.connection.db.collection('requestlogs')
    .find({ userId: 'U003' })
    .sort({ createdAt: -1 })
    .limit(3)
    .toArray();
  
  console.log(`\n📦 RequestLog (U003) - ${requestlogs.length} records:\n`);
  requestlogs.forEach(req => {
    console.log('Request Date:', req.requestDate);
    console.log('  requesterFirstName:', req.requesterFirstName);
    console.log('  requesterLastName:', req.requesterLastName);
    console.log('  requesterNickname:', req.requesterNickname);
    console.log('  requesterPhone:', req.requesterPhone);
    console.log('  requesterOffice:', req.requesterOffice);
    console.log('  requesterDepartment:', req.requesterDepartment);
    console.log('');
  });
  
  // Check recent returnlogs with userId U003
  const returnlogs = await mongoose.connection.db.collection('returnlogs')
    .find({ userId: 'U003' })
    .sort({ createdAt: -1 })
    .limit(3)
    .toArray();
  
  console.log(`\n🔙 ReturnLog (U003) - ${returnlogs.length} records:\n`);
  returnlogs.forEach(ret => {
    console.log('Return Date:', ret.returnDate);
    console.log('  returnerFirstName:', ret.returnerFirstName);
    console.log('  returnerLastName:', ret.returnerLastName);
    console.log('  returnerNickname:', ret.returnerNickname);
    console.log('  returnerPhone:', ret.returnerPhone);
    console.log('  returnerOffice:', ret.returnerOffice);
    console.log('  returnerDepartment:', ret.returnerDepartment);
    console.log('');
  });
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

