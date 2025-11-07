/**
 * Add database indexes for IssueLog collection
 * This script creates indexes to improve query performance
 */

const mongoose = require('mongoose');
const path = require('path');

// Try to load .env.local first, then fallback to .env
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
if (!process.env.MONGODB_URI) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
}

async function addIndexes() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const IssueLog = mongoose.connection.collection('issuelogs');

    console.log('\n📊 Adding indexes to IssueLog collection...\n');

    // 1. Index for filtering by status
    await IssueLog.createIndex({ status: 1 }, { background: true });
    console.log('✅ Created index: status');

    // 2. Index for sorting by reportDate (descending)
    await IssueLog.createIndex({ reportDate: -1 }, { background: true });
    console.log('✅ Created index: reportDate (descending)');

    // 3. Compound index for status + urgency + reportDate (for pending items)
    await IssueLog.createIndex(
      { status: 1, urgency: -1, reportDate: 1 },
      { background: true, name: 'status_urgency_reportDate' }
    );
    console.log('✅ Created compound index: status + urgency + reportDate');

    // 4. Index for requesterId (for populate operations)
    await IssueLog.createIndex({ requesterId: 1 }, { background: true });
    console.log('✅ Created index: requesterId');

    // 5. Index for assignedAdminId (for populate operations)
    await IssueLog.createIndex({ assignedAdminId: 1 }, { background: true, sparse: true });
    console.log('✅ Created index: assignedAdminId (sparse)');

    // 6. Index for issueId (for search by issue ID)
    await IssueLog.createIndex({ issueId: 1 }, { background: true, unique: true });
    console.log('✅ Created index: issueId (unique)');

    // 7. Text index for search functionality
    await IssueLog.createIndex(
      { firstName: 'text', lastName: 'text', email: 'text', phone: 'text', issueId: 'text' },
      { background: true, name: 'text_search' }
    );
    console.log('✅ Created text index for search');

    // 8. Index for closedDate (for closed items)
    await IssueLog.createIndex({ closedDate: -1 }, { background: true, sparse: true });
    console.log('✅ Created index: closedDate (sparse)');

    console.log('\n🎉 All indexes created successfully!');

    // Show all indexes
    const indexes = await IssueLog.indexes();
    console.log('\n📋 All indexes on IssueLog collection:');
    indexes.forEach((index, i) => {
      console.log(`  ${i + 1}. ${JSON.stringify(index.key)} - ${index.name || 'default'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  }
}

addIndexes();

