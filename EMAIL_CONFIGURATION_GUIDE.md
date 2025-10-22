# 📧 คู่มือการตั้งค่าอีเมล (Email Configuration Guide)

## 🎯 ภาพรวม

ระบบ Next Inventory Management ใช้ **Nodemailer** สำหรับส่งอีเมลแจ้งเตือนต่างๆ เช่น:
- ✅ แจ้งงาน IT ใหม่ไปยังทีม IT
- 📩 แจ้งผู้แจ้งเมื่อได้รับเรื่องแล้ว
- 🔧 แจ้งเมื่อ IT รับงาน
- 🎉 แจ้งเมื่อ IT ส่งงานเสร็จ
- 👤 แจ้งเมื่อมีผู้ใช้สมัครสมาชิกใหม่

---

## 📝 วิธีการเปลี่ยนอีเมลทีละขั้นตอน

### **ขั้นตอนที่ 1: เตรียม App Password จาก Gmail**

#### 1.1 เข้าสู่ Google Account
- ไปที่: https://myaccount.google.com/
- เข้าสู่ระบบด้วยบัญชี Gmail ที่ต้องการใช้

#### 1.2 เปิดใช้งาน 2-Step Verification (ถ้ายังไม่ได้เปิด)
1. คลิก **Security** ในเมนูด้านซ้าย
2. หาหัวข้อ **"How you sign in to Google"**
3. คลิก **2-Step Verification**
4. ทำตามขั้นตอนเพื่อเปิดใช้งาน

#### 1.3 สร้าง App Password
1. กลับไปที่ **Security**
2. หาหัวข้อ **"How you sign in to Google"**
3. คลิก **App passwords** (หรือไปที่: https://myaccount.google.com/apppasswords)
4. คลิก **Select app** → เลือก **Mail**
5. คลิก **Select device** → เลือก **Other (Custom name)**
6. พิมพ์ชื่อ: `Next Inventory System`
7. คลิก **Generate**
8. **คัดลอกรหัส 16 ตัวอักษรที่ได้** (เช่น `abcd efgh ijkl mnop`)

> ⚠️ **สำคัญ:** รหัสนี้จะแสดงเพียงครั้งเดียว กรุณาเก็บรักษาไว้ให้ดี!

---

### **ขั้นตอนที่ 2: แก้ไขไฟล์ `.env.local`**

#### 2.1 สร้างหรือแก้ไขไฟล์ `.env.local`

ในโฟลเดอร์โปรเจค (`next-inventory`), สร้างหรือแก้ไขไฟล์ชื่อ `.env.local`

```bash
# ถ้ายังไม่มีไฟล์ ให้สร้างใหม่:
# Windows: คลิกขวา → New → Text Document → เปลี่ยนชื่อเป็น .env.local
# Mac/Linux: touch .env.local
```

#### 2.2 เพิ่มการตั้งค่าอีเมล

เปิดไฟล์ `.env.local` และเพิ่ม/แก้ไขส่วนนี้:

```env
# Email Configuration (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
EMAIL_FROM=your-email@gmail.com
```

**แทนที่:**
- `your-email@gmail.com` → อีเมล Gmail ของคุณ
- `abcd efgh ijkl mnop` → App Password ที่คัดลอกมาจากขั้นตอนที่ 1.3

**ตัวอย่างจริง:**
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=mycompany.it@gmail.com
EMAIL_PASS=nkxz ypqw rhsg tlpm
EMAIL_FROM=mycompany.it@gmail.com
```

---

### **ขั้นตอนที่ 3: Restart Server**

หลังจากแก้ไขไฟล์แล้ว ให้รีสตาร์ทเซิร์ฟเวอร์:

```bash
# 1. หยุด server (กด Ctrl+C ในหน้าต่าง terminal)

# 2. รันใหม่
npm run dev
```

---

## 🔄 การใช้อีเมลอื่นที่ไม่ใช่ Gmail

### สำหรับ Outlook/Hotmail

```env
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASS=your-password
EMAIL_FROM=your-email@outlook.com
```

### สำหรับ Yahoo Mail

```env
EMAIL_HOST=smtp.mail.yahoo.com
EMAIL_PORT=587
EMAIL_USER=your-email@yahoo.com
EMAIL_PASS=your-app-password
EMAIL_FROM=your-email@yahoo.com
```

> **หมายเหตุ:** Yahoo Mail และ Outlook อาจต้องสร้าง App Password เช่นกัน

---

## 🧪 วิธีทดสอบว่าอีเมลทำงานหรือไม่

### วิธีที่ 1: ทดสอบผ่านระบบ

1. เปิดเว็บไซต์ http://localhost:3000
2. ไปที่หน้า **"แจ้งงาน IT"**
3. กรอกข้อมูลและส่งงาน IT ใหม่
4. ตรวจสอบว่าได้รับอีเมลหรือไม่

### วิธีที่ 2: ตรวจสอบ Console Log

เปิด Terminal ที่รัน `npm run dev` และดูว่ามี error หรือไม่:

```bash
# ถ้าส่งสำเร็จจะเห็น:
✅ Email sent successfully to IT Admin: admin@example.com

# ถ้าส่งไม่สำเร็จจะเห็น:
❌ Failed to send email to IT Admin: Error: Invalid login
```

---

## ❌ แก้ปัญหาที่พบบ่อย

### ปัญหา 1: "Invalid login" หรือ "Username and Password not accepted"

**สาเหตุ:** ใช้รหัสผ่านปกติแทน App Password

**วิธีแก้:**
- ตรวจสอบว่าได้สร้าง App Password แล้วหรือยัง
- ตรวจสอบว่าเปิด 2-Step Verification แล้วหรือยัง
- ลองสร้าง App Password ใหม่

### ปัญหา 2: "Connection timeout" หรือ "ETIMEDOUT"

**สาเหตุ:** พอร์ตถูกบล็อกโดย Firewall หรือ ISP

**วิธีแก้:**
- ลองเปลี่ยนจากพอร์ต 587 เป็น 465:
  ```env
  EMAIL_PORT=465
  EMAIL_HOST=smtp.gmail.com
  ```
- หรือตรวจสอบ Firewall/Antivirus

### ปัญหา 3: อีเมลไม่ถูกส่ง แต่ไม่มี error

**สาเหตุ:** ค่า environment variable ไม่ถูกโหลด

**วิธีแก้:**
1. ตรวจสอบว่าชื่อไฟล์คือ `.env.local` (ไม่ใช่ `.env.local.txt`)
2. Restart server ใหม่อีกครั้ง
3. ลองเปิด terminal ใหม่และรัน `npm run dev` อีกครั้ง

### ปัญหา 4: "Less secure app access"

**สาเหตุ:** Google ปิดการใช้งาน "Less secure apps" แล้ว

**วิธีแก้:**
- **ต้องใช้ App Password เท่านั้น** ไม่สามารถใช้รหัสผ่านปกติได้อีกต่อไป

---

## 📋 ตัวอย่างไฟล์ `.env.local` ฉบับเต็ม

```env
# =============================================================================
# NEXT INVENTORY MANAGEMENT SYSTEM - ENVIRONMENT CONFIGURATION
# =============================================================================

# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database-name?retryWrites=true&w=majority

# JWT Configuration  
JWT_SECRET=my-super-secret-jwt-key-2024

# Email Configuration (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password-here
EMAIL_FROM=your-email@gmail.com

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=my-nextauth-secret-2024

# Google OAuth Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Super Admin Configuration
SUPER_ADMIN_EMAIL=admin@gmail.com
SUPER_ADMIN_PASSWORD=ChangeThisPassword123
SUPER_ADMIN_FIRST_NAME=Super
SUPER_ADMIN_LAST_NAME=Administrator
SUPER_ADMIN_NICKNAME=SuperAdmin
SUPER_ADMIN_DEPARTMENT=System Administration
SUPER_ADMIN_OFFICE=สำนักงานใหญ่
SUPER_ADMIN_PHONE=000-000-0000

# System Flags
ENABLE_AUTO_SUPER_ADMIN_CREATION=true
```

---

## 🔒 ความปลอดภัย

### ⚠️ ข้อควรระวัง

1. **อย่าแชร์ไฟล์ `.env.local`** กับใครก็ตาม
2. **อย่าอัพโหลด `.env.local` ขึ้น Git** (ไฟล์นี้ถูก ignore อยู่แล้ว)
3. **อย่าใช้รหัสผ่านปกติ** ต้องใช้ App Password เท่านั้น
4. **เปลี่ยน App Password เป็นระยะ** สำหรับความปลอดภัย
5. **อย่าใช้อีเมลส่วนตัว** สำหรับระบบ production

### ✅ Best Practices

1. **สร้างอีเมลแยก** เฉพาะสำหรับระบบ (เช่น `it-system@company.com`)
2. **ตั้งชื่อ App Password ให้ชัดเจน** เพื่อจัดการได้ง่าย
3. **ใช้อีเมลที่มีความน่าเชื่อถือ** เพื่อป้องกันอีเมลติด Spam
4. **เก็บ backup ค่า configuration** ไว้ในที่ปลอดภัย
5. **ใช้ environment variables** สำหรับ production deployment

---

## 📞 ต้องการความช่วยเหลือเพิ่มเติม?

หากมีปัญหาหรือข้อสงสัย:

1. ตรวจสอบ Console Log ใน Terminal
2. ตรวจสอบ Browser Console (F12)
3. ดู error message ที่แสดง
4. ทดสอบส่งอีเมลผ่านเว็บไซต์ของ Email Provider ก่อน

---

## 📚 เอกสารอ้างอิง

- [Nodemailer Documentation](https://nodemailer.com/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)

---

**อัพเดทล่าสุด:** วันที่ 22 ตุลาคม 2025
**เวอร์ชัน:** 1.0
**ผู้จัดทำ:** Next Inventory Management System

