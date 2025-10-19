const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/inventory').then(async () => {
  console.log('Connected to MongoDB');
  
  // Check users collection for branch users
  const users = await mongoose.connection.db.collection('users').find({ userType: 'branch' }).toArray();
  
  console.log('\n🏢 Branch Users:\n');
  users.forEach(user => {
    console.log('User ID:', user.user_id);
    console.log('User Type:', user.userType);
    console.log('Office:', user.office);
    console.log('firstName:', user.firstName);
    console.log('lastName:', user.lastName);
    console.log('---');
  });
  
  // Check if there are any issuelogs with branch users
  const issuelogs = await mongoose.connection.db.collection('issuelogs').find({}).toArray();
  
  if (issuelogs.length > 0) {
    console.log('\n📋 Issue Logs:\n');
    issuelogs.forEach(issue => {
      console.log('Issue ID:', issue.issueId);
      console.log('Requester ID:', issue.requesterId);
      console.log('Requester Type:', issue.requesterType);
      console.log('firstName:', issue.firstName);
      console.log('lastName:', issue.lastName);
      console.log('nickname:', issue.nickname);
      console.log('phone:', issue.phone);
      console.log('office:', issue.office);
      console.log('---');
    });
  } else {
    console.log('\n📋 No issuelogs found');
  }
  
  // Check DeletedUsers
  const deletedUsers = await mongoose.connection.db.collection('deletedusers').find({}).toArray();
  
  if (deletedUsers.length > 0) {
    console.log('\n🗑️ Deleted Users:\n');
    deletedUsers.forEach(user => {
      console.log('User ID:', user.user_id);
      console.log('User Type:', user.userType);
      console.log('Office:', user.office);
      console.log('firstName:', user.firstName);
      console.log('lastName:', user.lastName);
      console.log('---');
    });
  }
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

