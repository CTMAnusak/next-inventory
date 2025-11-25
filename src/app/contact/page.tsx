'use client';

import Layout from '@/components/Layout';
import { Phone, Mail, MessageCircle } from 'lucide-react';

export default function ContactPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
            ติดต่อทีม IT Support
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Phone */}
            <div className="text-center p-6 bg-blue-50 rounded-lg">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 text-white rounded-full mb-4">
                <Phone className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                โทรศัพท์
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                <a 
                  href="tel:0811345646" 
                  className="text-blue-600 font-medium text-lg hover:text-blue-800 underline cursor-pointer block"
                >
                  081-134-5646
                </a> <span className="text-blue-600 font-medium text-lg">(เบอร์ทีม IT)</span>
                </p>
                <p className="text-sm text-gray-600 mt-1">(เวลาทำการ 09.00 - 20.00 น.)</p>
            </div>

            {/* Line */}
            <div className="text-center p-6 bg-green-50 rounded-lg">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 text-white rounded-full mb-4">
                <MessageCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Line Official
              </h3>
              <a 
                href="https://line.me/ti/p/~vsqitsupport" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-green-600 font-medium text-lg hover:text-green-800 underline cursor-pointer block"
              >
                V Square it support
              </a>
              <p className="text-green-600 font-medium text-lg">(Line Id : vsqitsupport)</p>
              <p className="text-sm text-gray-600 mt-1">
                สำหรับการสนทนาแบบทันที
              </p>
            </div>

            {/* Email */}
            <div className="text-center p-6 bg-purple-50 rounded-lg">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500 text-white rounded-full mb-4">
                <Mail className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                อีเมล
              </h3>
              <a 
                href="mailto:it@vsqclinic.com" 
                className="text-purple-600 font-medium text-lg hover:text-purple-800 underline cursor-pointer block"
              >
                it@vsqclinic.com
              </a>
              <p className="text-sm text-gray-600 mt-1">
                สำหรับการติดต่ออย่างเป็นทางการ
              </p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-8 p-6 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              วิธีการขอความช่วยเหลือ
            </h3>
            <div className="space-y-3 text-gray-700">
              <div className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3">
                  1
                </span>
                <div>
                  <p className="font-medium">เลือกเมนู "แจ้งงาน IT"</p>
                  <p className="text-sm text-gray-600">กรอกข้อมูลให้ครบถ้วนและแนบรูปภาพหากจำเป็น</p>
                </div>
              </div>

              <div className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3">
                  2
                </span>
                <div>
                  <p className="font-medium">กด "แจ้งงาน"</p>
                  <p className="text-sm text-gray-600">ระบบจะส่งหมายเลขงาน (Issue ID) ให้ทางอีเมล</p>
                </div>
              </div>

              <div className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3">
                  3
                </span>
                <div>
                  <p className="font-medium">ติดตามสถานะงาน</p>
                  <p className="text-sm text-gray-600">ผ่านเมนู "ติดตามสถานะ" หรือคลิกลิงก์ในอีเมล</p>
                </div>
              </div>

              <div className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3">
                  4
                </span>
                <div>
                  <p className="font-medium">ปิดงาน</p>
                  <p className="text-sm text-gray-600">เมื่อปัญหาได้รับการแก้ไข สามารถกดปิดงานได้เองผ่านทางระบบ</p>
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Phone className="w-5 h-5 text-red-500" />
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-red-800">
                  กรณีเร่งด่วน
                </h4>
                <p className="text-sm text-red-700">
                  หากเป็นปัญหาที่ส่งผลกระทบต่อการดำเนินงานอย่างร้ายแรง กรุณาโทรติดต่อโดยตรงที่{' '}
                  <a 
                    href="tel:0811345646" 
                    className="text-red-800 font-medium hover:text-red-900 underline cursor-pointer"
                  >
                    081-134-5646
                  </a> (เบอร์ทีม IT)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
