import { NextRequest, NextResponse } from 'next/server';

// Parent route for equipment-reports endpoints
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Equipment Reports API',
    endpoints: [
      '/api/admin/equipment-reports/available-items',
      '/api/admin/equipment-reports/requests',
      '/api/admin/equipment-reports/returns',
      '/api/admin/equipment-reports/user-owned'
    ]
  });
}
