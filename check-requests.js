/**
 * Check all requests in database
 * Usage: node check-requests.js
 */

require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory';

async function checkRequests() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log(`   URI: ${MONGODB_URI}\n`);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Define RequestLog schema (simplified)
    const RequestLogSchema = new mongoose.Schema({}, { strict: false });
    const RequestLog = mongoose.models.RequestLog || mongoose.model('RequestLog', RequestLogSchema);

    // Count all requests by status
    const totalRequests = await RequestLog.countDocuments();
    const pendingRequests = await RequestLog.countDocuments({ status: 'pending' });
    const approvedRequests = await RequestLog.countDocuments({ status: 'approved' });
    const rejectedRequests = await RequestLog.countDocuments({ status: 'rejected' });

    console.log('📊 Request Statistics:');
    console.log(`   Total: ${totalRequests}`);
    console.log(`   Pending: ${pendingRequests}`);
    console.log(`   Approved: ${approvedRequests}`);
    console.log(`   Rejected: ${rejectedRequests}\n`);

    // Get all requests
    const allRequests = await RequestLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    if (allRequests.length === 0) {
      console.log('❌ No requests found in database');
      return;
    }

    console.log(`📋 Most recent ${allRequests.length} requests:\n`);

    allRequests.forEach((req, idx) => {
      console.log(`${idx + 1}. RequestLog ID: ${req._id}`);
      console.log(`   Status: ${req.status}`);
      console.log(`   User ID: ${req.userId}`);
      console.log(`   Requester: ${req.requesterFirstName || 'N/A'} ${req.requesterLastName || 'N/A'}`);
      console.log(`   Created At: ${req.createdAt}`);
      console.log(`   Items: ${req.items?.length || 0}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

checkRequests();

