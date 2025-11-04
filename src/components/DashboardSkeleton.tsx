import React from 'react';

/**
 * Skeleton Loading Component สำหรับหน้า Dashboard
 * แสดงขณะกำลังโหลดข้อมูลครั้งแรก เพื่อป้องกันการแสดงข้อมูลเก่าที่ไม่ถูกต้อง
 */
export default function DashboardSkeleton() {
  return (
    <div className="max-w-full mx-auto animate-pulse">
      {/* Header Skeleton */}
      <div className="mb-8">
        <div className="h-9 bg-gray-300 rounded-lg w-96 mb-3"></div>
        <div className="h-5 bg-gray-200 rounded-lg w-64"></div>
      </div>

      {/* Quick Actions Grid Skeleton */}
      <div className="grid grid-cols-1 min-[550px]:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/50"
          >
            <div className="flex items-start">
              <div className="w-12 h-12 bg-gray-300 rounded-lg"></div>
              <div className="ml-4 flex-1">
                <div className="h-6 bg-gray-300 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Equipment Table Skeleton */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg py-8 px-6 border border-white/50">
        {/* Table Header Skeleton */}
        <div className="flex flex-col md:flex-row text-center md:text-left justify-between mb-7 gap-4">
          <div className="h-8 bg-gray-300 rounded-lg w-80 mx-auto md:mx-0"></div>
          <div className="flex items-center justify-center gap-2">
            <div className="h-10 bg-gray-200 rounded-md w-28"></div>
            <div className="h-10 bg-gray-300 rounded-md w-36"></div>
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-300">
                {[
                  'วันที่เพิ่ม',
                  'ชื่อ',
                  'นามสกุล',
                  'ชื่อเล่น',
                  'แผนก',
                  'ออฟฟิศ/สาขา',
                  'เบอร์โทร',
                  'สถานที่จัดส่ง',
                  'ชื่ออุปกรณ์',
                  'หมวดหมู่',
                  'สภาพ',
                  'สถานะ',
                  'รายละเอียด',
                  'จัดการ',
                ].map((header, idx) => (
                  <th
                    key={idx}
                    className="px-3 py-2 text-center border-b text-white"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((row) => (
                <tr
                  key={row}
                  className={row % 2 === 0 ? 'bg-white' : 'bg-blue-50'}
                >
                  {/* วันที่เพิ่ม */}
                  <td className="px-3 py-4 text-center border-b">
                    <div className="h-5 bg-gray-200 rounded w-24 mx-auto"></div>
                  </td>
                  {/* ชื่อ */}
                  <td className="px-3 py-4 text-center border-b">
                    <div className="h-5 bg-gray-200 rounded w-20 mx-auto"></div>
                  </td>
                  {/* นามสกุล */}
                  <td className="px-3 py-4 text-center border-b">
                    <div className="h-5 bg-gray-200 rounded w-24 mx-auto"></div>
                  </td>
                  {/* ชื่อเล่น */}
                  <td className="px-3 py-4 text-center border-b">
                    <div className="h-5 bg-gray-200 rounded w-16 mx-auto"></div>
                  </td>
                  {/* แผนก */}
                  <td className="px-3 py-4 text-center border-b">
                    <div className="h-5 bg-gray-200 rounded w-20 mx-auto"></div>
                  </td>
                  {/* ออฟฟิศ/สาขา */}
                  <td className="px-3 py-4 text-center border-b">
                    <div className="h-5 bg-gray-200 rounded w-20 mx-auto"></div>
                  </td>
                  {/* เบอร์โทร */}
                  <td className="px-3 py-4 text-center border-b">
                    <div className="h-5 bg-gray-200 rounded w-24 mx-auto"></div>
                  </td>
                  {/* สถานที่จัดส่ง */}
                  <td className="px-3 py-4 text-center border-b">
                    <div className="h-5 bg-gray-200 rounded w-20 mx-auto"></div>
                  </td>
                  {/* ชื่ออุปกรณ์ */}
                  <td className="px-3 py-4 text-center border-b">
                    <div className="h-5 bg-gray-200 rounded w-32 mx-auto"></div>
                  </td>
                  {/* หมวดหมู่ */}
                  <td className="px-3 py-4 text-center border-b">
                    <div className="h-5 bg-gray-200 rounded w-20 mx-auto"></div>
                  </td>
                  {/* สภาพ */}
                  <td className="px-3 py-4 text-center border-b">
                    <div className="h-5 bg-gray-200 rounded w-20 mx-auto"></div>
                  </td>
                  {/* สถานะ */}
                  <td className="px-3 py-4 text-center border-b">
                    <div className="h-5 bg-gray-200 rounded w-16 mx-auto"></div>
                  </td>
                  {/* รายละเอียด */}
                  <td className="px-3 py-4 text-center border-b">
                    <div className="h-6 bg-gray-200 rounded w-16 mx-auto"></div>
                  </td>
                  {/* จัดการ */}
                  <td className="px-3 py-4 text-center border-b">
                    <div className="flex items-center justify-center gap-1">
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                      <div className="h-6 bg-gray-200 rounded w-12"></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Information Note Skeleton */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="h-5 bg-gray-300 rounded w-24 mb-3"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-4/5"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

