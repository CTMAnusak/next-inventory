const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/inventory').then(async () => {
  console.log('Connected to MongoDB');
  
  const collections = await mongoose.connection.db.listCollections().toArray();
  
  console.log('\n📚 Collections in database:\n');
  collections.forEach(col => {
    console.log('-', col.name);
  });
  
  // Check issuelogs collection
  const issuelogsCount = await mongoose.connection.db.collection('issuelogs').countDocuments();
  console.log('\n📊 issuelogs collection has', issuelogsCount, 'documents');
  
  if (issuelogsCount > 0) {
    console.log('\n📋 Sample issuelogs documents:\n');
    const samples = await mongoose.connection.db.collection('issuelogs').find({}).sort({ reportDate: -1 }).limit(10).toArray();
    
    samples.forEach((doc, index) => {
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
  }
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

