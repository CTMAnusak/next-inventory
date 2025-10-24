'use client';

import Layout from '@/components/Layout';
import { FileText, User, Search, CheckCircle } from 'lucide-react';

export default function ITManualPage() {
  const steps = [
    {
      icon: User,
      title: "เลือกเมนู แจ้งงาน IT และกรอกข้อมูลให้ครบถ้วน",
      description: "กรอกข้อมูลส่วนตัว รายละเอียดปัญหา และแนบรูปภาพประกอบ (หากมี)",
      color: "bg-blue-500"
    },
    {
      icon: FileText,
      title: "กด แจ้งงาน ระบบจะส่งหมายเลขงาน (Issue ID) ให้ทางอีเมล",
      description: "ระบบจะสร้าง Issue ID เฉพาะและส่งรายละเอียดไปยังอีเมลของคุณ",
      color: "bg-green-500"
    },
    {
      icon: Search,
      title: "ติดตามสถานะงานผ่านเมนู ติดตามสถานะ หรือคลิกลิงก์ในอีเมล",
      description: "ใช้ Issue ID เพื่อติดตามสถานะการดำเนินงานได้ตลอดเวลา",
      color: "bg-purple-500"
    },
    {
      icon: CheckCircle,
      title: "เมื่อปัญหาได้รับการแก้ไข สามารถกดปิดงานได้เองผ่านอีเมล",
      description: "หลังจากทีม IT แก้ไขปัญหาเสร็จ คุณจะได้รับอีเมลพร้อมลิงก์สำหรับปิดงาน",
      color: "bg-orange-500"
    }
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-md px-6 py-10 sm:p-10">
          <h1 className="text-2xl font-semibold text-gray-900 mb-10 text-center">
            คู่มือการใช้งานระบบแจ้งงาน IT
          </h1>

          <div className="space-y-8">
            {steps.map((step, index) => (
              <div key={index} className="flex items-start flex-row">
                <div className={`flex-shrink-0 w-12 h-12 ${step.color} text-white rounded-full flex items-center justify-center mr-4`}>
                  <step.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {index + 1}. {step.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Additional Information */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-800 mb-3">
                สิ่งที่ควรระบุในการแจ้งปัญหา
              </h3>
              <ul className="space-y-2 text-yellow-700">
                <li>• อาการของปัญหาที่เกิดขึ้น</li>
                <li>• ขั้นตอนที่ทำก่อนเกิดปัญหา</li>
                <li>• เวลาที่เกิดปัญหา</li>
                <li>• รูปภาพหน้าจอ error (หากมี)</li>
                <li>• อุปกรณ์ที่เกี่ยวข้อง</li>
              </ul>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-800 mb-3">
                สถานะการดำเนินงาน
              </h3>
              <ul className="space-y-2 text-green-700">
                <li>• <strong>รอดำเนินการ:</strong> งานอยู่ในคิวรอการจัดการ</li>
                <li>• <strong>กำลังดำเนินการ:</strong> ทีม IT กำลังแก้ไขปัญหา</li>
                <li>• <strong>ดำเนินการแล้ว:</strong> แก้ไขเสร็จ รอการยืนยัน</li>
                <li>• <strong>ปิดงาน:</strong> งานเสร็จสิ้นสมบูรณ์</li>
              </ul>
            </div>
          </div>

          {/* Contact Information */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">
              ช่องทางติดต่อทีม IT
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-blue-700">
              <div>
                <strong className="font-semibold">โทรศัพท์:</strong> 092-591-9889 (คุณเบลล์)
                <br />
                <span className="text-sm">(โปรดติดต่อในเวลาทำการ หรือติดต่อผ่าน Line)</span>
              </div>
              <div>
                <strong className="font-semibold">Line Official:</strong> vsqitsupport
              </div>
              <div>
                <strong className="font-semibold">อีเมล:</strong> vexclusive.it@gmail.com
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              เคล็ดลับการใช้งาน
            </h3>
            <ul className="space-y-2 text-gray-700">
              <li>• เก็บ Issue ID ไว้เพื่อการติดตามงาน</li>
              <li>• ตรวจสอบอีเมลเป็นประจำเพื่อรับการอัพเดตสถานะ</li>
              <li>• หากเป็นปัญหาเร่งด่วน ให้เลือก "ด่วนมาก" และโทรติดต่อเพิ่มเติม</li>
              <li>• ถ่ายรูปหน้าจอ error เพื่อช่วยให้ทีม IT วินิจฉัยปัญหาได้รวดเร็วขึ้น</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}
