const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/inventory').then(async () => {
  console.log('Connected to MongoDB\n');
  
  // Check issuelogs with requesterId = U003
  const issuelogs = await mongoose.connection.db.collection('issuelogs')
    .find({ requesterId: 'U003' })
    .sort({ reportDate: -1 })
    .toArray();
  
  console.log(`📊 Found ${issuelogs.length} issuelogs with requesterId = U003\n`);
  
  issuelogs.forEach((issue, index) => {
    console.log(`--- Issue ${index + 1} ---`);
    console.log('issueId:', issue.issueId);
    console.log('requesterId:', issue.requesterId);
    console.log('requesterType:', issue.requesterType);
    console.log('firstName:', issue.firstName);
    console.log('lastName:', issue.lastName);
    console.log('nickname:', issue.nickname);
    console.log('phone:', issue.phone);
    console.log('email:', issue.email);
    console.log('department:', issue.department);
    console.log('office:', issue.office);
    console.log('reportDate:', issue.reportDate);
    console.log('');
  });
  
  // Check DeletedUsers
  const deletedUsers = await mongoose.connection.db.collection('deletedusers')
    .find({})
    .toArray();
  
  if (deletedUsers.length > 0) {
    console.log('\n🗑️ DeletedUsers:\n');
    deletedUsers.forEach(user => {
      console.log('User ID:', user.user_id);
      console.log('User Type:', user.userType);
      console.log('Office:', user.office);
      console.log('firstName:', user.firstName);
      console.log('lastName:', user.lastName);
      console.log('nickname:', user.nickname);
      console.log('phone:', user.phone);
      console.log('email:', user.email);
      console.log('---');
    });
  }
  
  // Check current User U003
  const currentUser = await mongoose.connection.db.collection('users')
    .findOne({ user_id: 'U003' });
  
  if (currentUser) {
    console.log('\n👤 Current User U003:\n');
    console.log('User ID:', currentUser.user_id);
    console.log('User Type:', currentUser.userType);
    console.log('Office:', currentUser.office);
    console.log('firstName:', currentUser.firstName);
    console.log('lastName:', currentUser.lastName);
    console.log('nickname:', currentUser.nickname);
    console.log('phone:', currentUser.phone);
    console.log('email:', currentUser.email);
  } else {
    console.log('\n👤 User U003 not found (already deleted?)');
  }
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

