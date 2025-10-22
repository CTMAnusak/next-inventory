/**
 * สคริปต์ทดสอบการส่งอีเมล
 * ใช้สำหรับทดสอบว่าการตั้งค่าอีเมลใน .env.local ถูกต้องหรือไม่
 * 
 * วิธีใช้งาน:
 * 1. ตรวจสอบว่าได้ตั้งค่า EMAIL_* ใน .env.local แล้ว
 * 2. แก้ไข TEST_RECIPIENT_EMAIL ด้านล่างเป็นอีเมลที่ต้องการทดสอบ
 * 3. รันสคริปต์: node test-email-configuration.js
 * 4. ตรวจสอบอีเมลในกล่องจดหมาย
 */

require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

// ==========================================
// ⚙️ ตั้งค่าตรงนี้
// ==========================================
const TEST_RECIPIENT_EMAIL = 'test@example.com'; // ⬅️ แก้ไขเป็นอีเมลที่ต้องการทดสอบ
// ==========================================

console.log('🔍 กำลังตรวจสอบการตั้งค่าอีเมล...\n');

// ตรวจสอบ environment variables
const config = {
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASS,
  from: process.env.EMAIL_FROM,
};

console.log('📋 ค่าที่ตั้งไว้:');
console.log(`   EMAIL_HOST: ${config.host || '❌ ไม่ได้ตั้งค่า'}`);
console.log(`   EMAIL_PORT: ${config.port || '❌ ไม่ได้ตั้งค่า'}`);
console.log(`   EMAIL_USER: ${config.user || '❌ ไม่ได้ตั้งค่า'}`);
console.log(`   EMAIL_PASS: ${config.pass ? '✅ ตั้งค่าแล้ว (ซ่อน)' : '❌ ไม่ได้ตั้งค่า'}`);
console.log(`   EMAIL_FROM: ${config.from || '❌ ไม่ได้ตั้งค่า'}`);
console.log('');

// ตรวจสอบว่าครบทุกค่าหรือไม่
const missingConfigs = [];
if (!config.host) missingConfigs.push('EMAIL_HOST');
if (!config.port) missingConfigs.push('EMAIL_PORT');
if (!config.user) missingConfigs.push('EMAIL_USER');
if (!config.pass) missingConfigs.push('EMAIL_PASS');
if (!config.from) missingConfigs.push('EMAIL_FROM');

if (missingConfigs.length > 0) {
  console.error('❌ ขาดการตั้งค่าต่อไปนี้ในไฟล์ .env.local:');
  missingConfigs.forEach(item => console.error(`   - ${item}`));
  console.error('\n📖 กรุณาอ่านคู่มือใน EMAIL_CONFIGURATION_GUIDE.md');
  process.exit(1);
}

// ตรวจสอบอีเมลผู้รับ
if (TEST_RECIPIENT_EMAIL === 'test@example.com') {
  console.error('❌ กรุณาแก้ไข TEST_RECIPIENT_EMAIL ในสคริปต์นี้เป็นอีเมลที่ต้องการทดสอบ');
  process.exit(1);
}

console.log(`📧 กำลังส่งอีเมลทดสอบไปที่: ${TEST_RECIPIENT_EMAIL}\n`);

// สร้าง transporter
const transporter = nodemailer.createTransport({
  host: config.host,
  port: parseInt(config.port),
  secure: parseInt(config.port) === 465, // true for 465, false for other ports
  auth: {
    user: config.user,
    pass: config.pass,
  },
  debug: true, // แสดงข้อมูล debug
  logger: true, // แสดง log
});

// ข้อมูลอีเมลทดสอบ
const mailOptions = {
  from: `Next Inventory System <${config.from}>`,
  to: TEST_RECIPIENT_EMAIL,
  subject: '✅ ทดสอบการส่งอีเมล - Next Inventory System',
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px; text-align: center;">✅ การทดสอบสำเร็จ!</h1>
      </div>
      
      <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <div style="background-color: #e8f5e9; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 5px solid #4caf50;">
          <h2 style="color: #2e7d32; margin: 0 0 15px 0; font-size: 18px;">🎉 การตั้งค่าอีเมลถูกต้อง!</h2>
          <p style="margin: 5px 0; color: #666;">ระบบสามารถส่งอีเมลได้เรียบร้อยแล้ว</p>
        </div>

        <div style="margin: 25px 0;">
          <h3 style="color: #667eea; margin-bottom: 15px;">📋 ข้อมูลการทดสอบ</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; width: 150px;"><strong>ส่งจาก:</strong></td>
              <td style="padding: 8px 0;">${config.from}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>ส่งถึง:</strong></td>
              <td style="padding: 8px 0;">${TEST_RECIPIENT_EMAIL}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>SMTP Server:</strong></td>
              <td style="padding: 8px 0;">${config.host}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Port:</strong></td>
              <td style="padding: 8px 0;">${config.port}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>วันที่ทดสอบ:</strong></td>
              <td style="padding: 8px 0;">${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #e3f2fd; padding: 15px; margin: 20px 0; border-radius: 8px;">
          <p style="margin: 0; color: #1976d2;"><strong>✨ ขั้นตอนถัดไป:</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px; color: #666;">
            <li>ระบบพร้อมส่งอีเมลแจ้งเตือนแล้ว</li>
            <li>ลองทดสอบแจ้งงาน IT ในระบบ</li>
            <li>ตรวจสอบว่าได้รับอีเมลแจ้งเตือนหรือไม่</li>
          </ul>
        </div>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; border: 1px solid #e0e0e0; border-top: none;">
        <p style="margin: 0; color: #666; font-size: 14px;">📧 อีเมลทดสอบจากระบบ Next Inventory Management</p>
        <p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">ส่งเมื่อ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</p>
      </div>
    </div>
  `,
  text: `
✅ การทดสอบสำเร็จ!

การตั้งค่าอีเมลถูกต้อง!
ระบบสามารถส่งอีเมลได้เรียบร้อยแล้ว

ข้อมูลการทดสอบ:
- ส่งจาก: ${config.from}
- ส่งถึง: ${TEST_RECIPIENT_EMAIL}
- SMTP Server: ${config.host}
- Port: ${config.port}
- วันที่ทดสอบ: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}

ขั้นตอนถัดไป:
- ระบบพร้อมส่งอีเมลแจ้งเตือนแล้ว
- ลองทดสอบแจ้งงาน IT ในระบบ
- ตรวจสอบว่าได้รับอีเมลแจ้งเตือนหรือไม่

---
📧 อีเมลทดสอบจากระบบ Next Inventory Management
ส่งเมื่อ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
  `
};

// ส่งอีเมล
console.log('⏳ กำลังเชื่อมต่อกับ SMTP Server...\n');

transporter.sendMail(mailOptions)
  .then(info => {
    console.log('\n✅ ส่งอีเมลสำเร็จ!');
    console.log('📨 Message ID:', info.messageId);
    console.log('📧 ส่งไปที่:', TEST_RECIPIENT_EMAIL);
    console.log('\n🎉 การตั้งค่าอีเมลถูกต้อง!');
    console.log('💡 คุณสามารถใช้ระบบส่งอีเมลได้แล้ว');
    console.log('\n📖 หากต้องการเปลี่ยนอีเมล กรุณาดูคู่มือใน EMAIL_CONFIGURATION_GUIDE.md');
  })
  .catch(error => {
    console.error('\n❌ ส่งอีเมลไม่สำเร็จ!\n');
    console.error('📝 รายละเอียดข้อผิดพลาด:');
    console.error(error);
    console.error('\n');
    
    // วิเคราะห์ error และแนะนำการแก้ไข
    if (error.code === 'EAUTH') {
      console.error('🔍 สาเหตุที่เป็นไปได้:');
      console.error('   1. ❌ อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      console.error('   2. ❌ ใช้รหัสผ่านปกติแทน App Password');
      console.error('   3. ❌ ยังไม่ได้เปิด 2-Step Verification');
      console.error('\n💡 วิธีแก้ไข:');
      console.error('   1. ตรวจสอบ EMAIL_USER และ EMAIL_PASS ใน .env.local');
      console.error('   2. สร้าง App Password ใหม่ที่ https://myaccount.google.com/apppasswords');
      console.error('   3. อ่านคู่มือใน EMAIL_CONFIGURATION_GUIDE.md');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION') {
      console.error('🔍 สาเหตุที่เป็นไปได้:');
      console.error('   1. ❌ ไม่สามารถเชื่อมต่อกับ SMTP Server ได้');
      console.error('   2. ❌ พอร์ตถูกบล็อกโดย Firewall');
      console.error('   3. ❌ ปัญหาการเชื่อมต่ออินเทอร์เน็ต');
      console.error('\n💡 วิธีแก้ไข:');
      console.error('   1. ลองเปลี่ยน EMAIL_PORT เป็น 465 หรือ 587');
      console.error('   2. ตรวจสอบ Firewall/Antivirus');
      console.error('   3. ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
    } else {
      console.error('💡 แนะนำ:');
      console.error('   - ตรวจสอบค่าต่างๆ ใน .env.local');
      console.error('   - อ่านคู่มือใน EMAIL_CONFIGURATION_GUIDE.md');
      console.error('   - ตรวจสอบ error message ด้านบน');
    }
    
    process.exit(1);
  });

