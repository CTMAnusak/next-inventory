const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/inventory').then(async () => {
  console.log('Connected to MongoDB\n');
  
  // Check all issuelogs
  const issuelogs = await mongoose.connection.db.collection('issuelogs')
    .find({})
    .sort({ reportDate: -1 })
    .limit(10)
    .toArray();
  
  console.log(`📊 Found ${issuelogs.length} issuelogs (showing last 10)\n`);
  
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
  
  // Check all users
  const users = await mongoose.connection.db.collection('users')
    .find({})
    .toArray();
  
  console.log('\n👥 All Users:\n');
  users.forEach(user => {
    console.log('User ID:', user.user_id);
    console.log('User Type:', user.userType);
    console.log('Office:', user.office);
    console.log('firstName:', user.firstName || 'N/A');
    console.log('lastName:', user.lastName || 'N/A');
    console.log('email:', user.email);
    console.log('---');
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
      console.log('firstName:', user.firstName || 'N/A');
      console.log('lastName:', user.lastName || 'N/A');
      console.log('email:', user.email);
      console.log('---');
    });
  } else {
    console.log('\n🗑️ No deleted users found');
  }
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

