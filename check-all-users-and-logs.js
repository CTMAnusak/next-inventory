const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/inventory').then(async () => {
  console.log('Connected to MongoDB\n');
  
  // Check all users
  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  
  console.log('👥 All Users:\n');
  users.forEach(user => {
    console.log(`User ID: ${user.user_id}, Type: ${user.userType}, Office: ${user.office}, Name: ${user.firstName || '-'} ${user.lastName || '-'}`);
  });
  
  // Check recent issuelogs
  const issuelogs = await mongoose.connection.db.collection('issuelogs')
    .find({})
    .sort({ reportDate: -1 })
    .limit(5)
    .toArray();
  
  console.log(`\n\n📋 Recent IssueLog (Last 5):\n`);
  issuelogs.forEach(issue => {
    console.log(`Issue ID: ${issue.issueId}`);
    console.log(`  Requester ID: ${issue.requesterId}`);
    console.log(`  Name: ${issue.firstName} ${issue.lastName} (${issue.nickname})`);
    console.log(`  Office: ${issue.office}`);
    console.log(`  Phone: ${issue.phone}`);
    console.log('');
  });
  
  // Check recent requestlogs
  const requestlogs = await mongoose.connection.db.collection('requestlogs')
    .find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();
  
  console.log(`\n📦 Recent RequestLog (Last 5):\n`);
  requestlogs.forEach(req => {
    console.log(`User ID: ${req.userId}`);
    console.log(`  Requester: ${req.requesterFirstName} ${req.requesterLastName} (${req.requesterNickname})`);
    console.log(`  Office: ${req.requesterOffice}`);
    console.log(`  Phone: ${req.requesterPhone}`);
    console.log(`  Date: ${req.requestDate}`);
    console.log('');
  });
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

