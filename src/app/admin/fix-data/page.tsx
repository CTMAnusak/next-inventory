'use client';

import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { toast } from 'react-hot-toast';

export default function AdminFixDataPage() {
  const [loading, setLoading] = useState(false);
  const [indexLoading, setIndexLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [indexResults, setIndexResults] = useState<any>(null);

  const handleFixReturnIdMismatch = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/fix-return-id-mismatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('แก้ไข ID mismatch เรียบร้อยแล้ว');
        setResults(data);
        console.log('Fix results:', data);
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error fixing ID mismatch:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const handleFixSerialNumberIndex = async () => {
    setIndexLoading(true);
    try {
      const response = await fetch('/api/admin/fix-serialnumber-index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('แก้ไข Serial Number Index เรียบร้อยแล้ว');
        setIndexResults(data);
        console.log('Serial number index fix results:', data);
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error fixing serial number index:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIndexLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Data Fix Tools</h1>

          <div className="space-y-6">
            {/* Fix ReturnLog ID Mismatch */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                แก้ไข ReturnLog ID Mismatch
              </h2>
              <p className="text-gray-600 mb-4">
                แก้ไขปัญหา ReturnLog ที่ itemId อ้างอิงไป InventoryMaster แทนที่จะเป็น InventoryItem
              </p>
              
              <button
                onClick={handleFixReturnIdMismatch}
                disabled={loading}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  loading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {loading ? 'กำลังแก้ไข...' : 'แก้ไข ReturnLog ID Mismatch'}
              </button>
            </div>

            {/* Fix Serial Number Index */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                แก้ไข Serial Number Index
              </h2>
              <p className="text-gray-600 mb-4">
                แก้ไขปัญหา MongoDB index ที่ไม่อนุญาตให้มี serialNumber เป็น null หลายตัว
              </p>
              
              <button
                onClick={handleFixSerialNumberIndex}
                disabled={indexLoading}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  indexLoading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {indexLoading ? 'กำลังแก้ไข...' : 'แก้ไข Serial Number Index'}
              </button>
            </div>

            {/* Serial Number Index Results */}
            {indexResults && (
              <div className="border border-gray-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">ผลลัพธ์การแก้ไข Index</h2>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className={`flex items-center space-x-2 mb-2 ${
                    indexResults.success ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <span className="font-medium">
                      {indexResults.success ? '✅ สำเร็จ' : '❌ ล้มเหลว'}
                    </span>
                  </div>
                  
                  <p className="text-gray-700 mb-2">{indexResults.message}</p>
                  
                  {indexResults.details && (
                    <p className="text-sm text-gray-600">{indexResults.details}</p>
                  )}
                  
                  {!indexResults.success && indexResults.error && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                      Error: {indexResults.error}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Results Display */}
            {results && (
              <div className="border border-gray-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">ผลลัพธ์การแก้ไข</h2>
                
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h3 className="font-medium text-gray-900 mb-2">สรุป</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">ReturnLog ทั้งหมด:</span>
                      <span className="ml-2 font-medium">{results.summary?.totalReturnLogs}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">รายการทั้งหมด:</span>
                      <span className="ml-2 font-medium">{results.summary?.totalItems}</span>
                    </div>
                    <div>
                      <span className="text-green-600">แก้ไขแล้ว:</span>
                      <span className="ml-2 font-medium text-green-600">{results.summary?.fixed}</span>
                    </div>
                    <div>
                      <span className="text-blue-600">ถูกต้องอยู่แล้ว:</span>
                      <span className="ml-2 font-medium text-blue-600">{results.summary?.alreadyCorrect}</span>
                    </div>
                    <div>
                      <span className="text-red-600">ไม่พบ:</span>
                      <span className="ml-2 font-medium text-red-600">{results.summary?.notFound}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">ไม่ถูกต้อง:</span>
                      <span className="ml-2 font-medium text-gray-600">{results.summary?.invalid}</span>
                    </div>
                  </div>
                </div>

                {results.details && results.details.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">รายละเอียด</h3>
                    <div className="max-h-96 overflow-y-auto">
                      <table className="min-w-[140%] divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              ReturnLog ID
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              ชื่ออุปกรณ์
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Serial Number
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              สถานะ
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {results.details.map((detail: any, index: number) => (
                            <tr key={index}>
                              <td className="px-3 py-2 text-sm text-gray-900">
                                {detail.returnLogId}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900">
                                {detail.itemName}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900">
                                {detail.serialNumber || '-'}
                              </td>
                              <td className="px-3 py-2 text-sm">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  detail.status === 'fixed' 
                                    ? 'bg-green-100 text-green-800'
                                    : detail.status === 'already_correct'
                                    ? 'bg-blue-100 text-blue-800'
                                    : detail.status === 'not_found'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {detail.status === 'fixed' && 'แก้ไขแล้ว'}
                                  {detail.status === 'already_correct' && 'ถูกต้องแล้ว'}
                                  {detail.status === 'not_found' && 'ไม่พบ'}
                                  {detail.status === 'invalid' && 'ไม่ถูกต้อง'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
