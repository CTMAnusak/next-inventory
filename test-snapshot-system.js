const mongoose = require('mongoose');
const { User, IssueLog, RequestLog, ReturnLog, DeletedUsers } = require('./src/models');

async function testSnapshotSystem() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory');
    console.log('🔗 Connected to MongoDB');

    // 1. สร้างผู้ใช้ทดสอบ
    const testUser = new User({
      user_id: 'TEST001',
      firstName: 'Test',
      lastName: 'User',
      nickname: 'TestNick',
      department: 'IT',
      office: 'Bangkok',
      phone: '0812345678',
      email: 'test@example.com',
      userType: 'individual'
    });
    await testUser.save();
    console.log('✅ Created test user:', testUser.user_id);

    // 2. สร้าง IssueLog
    const issueLog = new IssueLog({
      issueId: 'ISSUE-TEST-001',
      userId: testUser._id,
      description: 'Test issue for snapshot testing',
      status: 'open',
      reportDate: new Date()
    });
    await issueLog.save();
    console.log('✅ Created IssueLog');

    // 3. สร้าง RequestLog
    const requestLog = new RequestLog({
      requestId: 'REQ-TEST-001',
      userId: testUser._id,
      itemName: 'Test Equipment',
      requestDate: new Date(),
      status: 'approved'
    });
    await requestLog.save();
    console.log('✅ Created RequestLog');

    // 4. สร้าง ReturnLog
    const returnLog = new ReturnLog({
      returnId: 'RET-TEST-001',
      userId: testUser._id,
      itemName: 'Test Equipment',
      returnDate: new Date(),
      status: 'completed'
    });
    await returnLog.save();
    console.log('✅ Created ReturnLog');

    console.log('\n📊 Test data created successfully!');
    console.log('User ID:', testUser.user_id);
    console.log('IssueLog ID:', issueLog._id);
    console.log('RequestLog ID:', requestLog._id);
    console.log('ReturnLog ID:', returnLog._id);

    // 5. ทดสอบการลบผู้ใช้และ snapshot
    console.log('\n🗑️ Testing user deletion with snapshot...');
    
    // เรียกใช้ API ลบผู้ใช้
    const response = await fetch('http://localhost:3000/api/admin/users/' + testUser._id, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      console.log('✅ User deleted successfully');
      
      // ตรวจสอบ DeletedUsers
      const deletedUser = await DeletedUsers.findOne({ userMongoId: testUser._id.toString() });
      if (deletedUser) {
        console.log('✅ Snapshot created in DeletedUsers:', deletedUser.user_id);
      } else {
        console.log('❌ No snapshot found in DeletedUsers');
      }

      // ตรวจสอบ IssueLog
      const updatedIssueLog = await IssueLog.findById(issueLog._id);
      if (updatedIssueLog && updatedIssueLog.firstName) {
        console.log('✅ IssueLog populated with snapshot data:', updatedIssueLog.firstName, updatedIssueLog.lastName);
      } else {
        console.log('❌ IssueLog not populated correctly');
      }

      // ตรวจสอบ RequestLog
      const updatedRequestLog = await RequestLog.findById(requestLog._id);
      if (updatedRequestLog && updatedRequestLog.firstName) {
        console.log('✅ RequestLog populated with snapshot data:', updatedRequestLog.firstName, updatedRequestLog.lastName);
      } else {
        console.log('❌ RequestLog not populated correctly');
      }

      // ตรวจสอบ ReturnLog
      const updatedReturnLog = await ReturnLog.findById(returnLog._id);
      if (updatedReturnLog && updatedReturnLog.firstName) {
        console.log('✅ ReturnLog populated with snapshot data:', updatedReturnLog.firstName, updatedReturnLog.lastName);
      } else {
        console.log('❌ ReturnLog not populated correctly');
      }

    } else {
      console.log('❌ Failed to delete user:', response.status);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testSnapshotSystem();
