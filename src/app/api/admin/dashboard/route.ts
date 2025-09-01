import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';
import RequestLog from '@/models/RequestLog';
import ReturnLog from '@/models/ReturnLog';
import User from '@/models/User';
import Inventory from '@/models/Inventory';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const monthNumber = monthParam && monthParam !== 'all' ? parseInt(monthParam) : undefined;

    // Create date range
    const startDate = monthNumber ? new Date(year, monthNumber - 1, 1) : new Date(year, 0, 1);
    const endDate = monthNumber ? new Date(year, monthNumber, 0, 23, 59, 59) : new Date(year, 11, 31, 23, 59, 59);

    // Fetch all data
    const [issues, requests, returns, users, inventory] = await Promise.all([
      IssueLog.find({}),
      RequestLog.find({}),
      ReturnLog.find({}),
      User.find({}),
      Inventory.find({})
    ]);

    // Filter data for the selected date range
    const monthlyIssues = issues.filter(issue => {
      const issueDate = new Date(issue.submittedAt);
      return issueDate >= startDate && issueDate <= endDate;
    });

    const monthlyRequests = requests.filter(request => {
      const requestDate = new Date(request.requestDate);
      return requestDate >= startDate && requestDate <= endDate;
    });

    const monthlyReturns = returns.filter(returnItem => {
      const returnDate = new Date(returnItem.returnDate);
      return returnDate >= startDate && returnDate <= endDate;
    });

    // Calculate stats
    const stats = {
      // Total counts
      totalIssues: issues.length,
      pendingIssues: issues.filter(i => i.status === 'pending').length,
      inProgressIssues: issues.filter(i => i.status === 'in_progress').length,
      completedIssues: issues.filter(i => i.status === 'completed').length,
      urgentIssues: issues.filter(i => i.urgency === 'very_urgent').length,
      totalRequests: requests.length,
      totalReturns: returns.length,
      totalUsers: users.length,
      totalInventoryItems: inventory.length,
      lowStockItems: inventory.filter(item => item.quantity <= 2 && !item.serialNumber).length,

      // Monthly data for charts
      monthlyIssues: generateMonthlyData(issues, 'submittedAt'),
      monthlyRequests: generateMonthlyData(requests, 'requestDate'),
      monthlyReturns: generateMonthlyData(returns, 'returnDate'),

      // Issues by category for pie chart
      issuesByCategory: generateCategoryData(monthlyIssues, 'issueCategory'),

      // Requests by urgency for pie chart
      requestsByUrgency: generateUrgencyData(monthlyRequests)
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}

function generateMonthlyData(data: any[], dateField: string) {
  const monthlyCount: { [key: string]: number } = {};
  
  data.forEach(item => {
    const date = new Date(item[dateField]);
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    monthlyCount[monthKey] = (monthlyCount[monthKey] || 0) + 1;
  });

  return Object.entries(monthlyCount).map(([month, count]) => ({
    month,
    count
  }));
}

function generateCategoryData(data: any[], categoryField: string) {
  const categoryCount: { [key: string]: number } = {};
  
  data.forEach(item => {
    const category = item[categoryField] || 'อื่นๆ';
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  });

  const total = data.length;
  
  return Object.entries(categoryCount)
    .map(([category, count]) => ({
      category,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count);
}

function generateUrgencyData(data: any[]) {
  const urgencyCount = {
    normal: 0,
    very_urgent: 0
  };
  
  data.forEach(item => {
    if (item.urgency === 'very_urgent') {
      urgencyCount.very_urgent++;
    } else {
      urgencyCount.normal++;
    }
  });

  const total = data.length;
  
  return [
    {
      urgency: 'ด่วนมาก',
      count: urgencyCount.very_urgent,
      percentage: total > 0 ? (urgencyCount.very_urgent / total) * 100 : 0
    },
    {
      urgency: 'ปกติ',
      count: urgencyCount.normal,
      percentage: total > 0 ? (urgencyCount.normal / total) * 100 : 0
    }
  ].filter(item => item.count > 0);
}
