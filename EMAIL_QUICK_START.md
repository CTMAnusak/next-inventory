# ⚡ Quick Start: เปลี่ยนอีเมลในระบบ

## 🚀 3 ขั้นตอนเปลี่ยนอีเมลแบบด่วน

### ✅ ขั้นตอนที่ 1: สร้าง App Password (Gmail)

1. ไปที่: https://myaccount.google.com/apppasswords
2. เปิด 2-Step Verification (ถ้ายังไม่ได้เปิด)
3. สร้าง App Password
4. คัดลอกรหัส 16 ตัวอักษรที่ได้

### ✅ ขั้นตอนที่ 2: แก้ไขไฟล์ `.env.local`

สร้างหรือแก้ไขไฟล์ `.env.local` ในโฟลเดอร์โปรเจค:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
EMAIL_FROM=your-email@gmail.com
```

**แทนที่:**
- `your-email@gmail.com` = อีเมลของคุณ
- `abcd efgh ijkl mnop` = App Password ที่คัดลอกมา

### ✅ ขั้นตอนที่ 3: Restart Server

```bash
# หยุด server (กด Ctrl+C)
# รันใหม่
npm run dev
```

---

## 🧪 ทดสอบอีเมล

```bash
# 1. แก้ไข TEST_RECIPIENT_EMAIL ในไฟล์ test-email-configuration.js
# 2. รันสคริปต์
node test-email-configuration.js
```

---

## ❌ แก้ปัญหาด่วน

### ส่งไม่ได้: "Invalid login"
- ❌ ใช้รหัสผ่านปกติ → ✅ ต้องใช้ App Password
- ❌ ยังไม่เปิด 2-Step Verification → ✅ เปิดก่อน

### ส่งไม่ได้: "Connection timeout"
- ลองเปลี่ยนพอร์ต 587 → 465
- ตรวจสอบ Firewall

---

## 📖 อ่านคู่มือฉบับเต็ม

ดูรายละเอียดเพิ่มเติมใน: **EMAIL_CONFIGURATION_GUIDE.md**

---

## 📧 ตัวอย่างค่าที่ถูกต้อง

```env
# ✅ ตัวอย่างที่ถูกต้อง
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=mycompany.it@gmail.com
EMAIL_PASS=nkxz ypqw rhsg tlpm
EMAIL_FROM=mycompany.it@gmail.com
```

```env
# ❌ ตัวอย่างที่ผิด
EMAIL_HOST=gmail.com                    # ❌ ต้องเป็น smtp.gmail.com
EMAIL_PORT=25                           # ❌ ต้องเป็น 587 หรือ 465
EMAIL_USER=myemail                      # ❌ ต้องใส่อีเมลเต็ม
EMAIL_PASS=MyPassword123                # ❌ ต้องใช้ App Password
EMAIL_FROM=no-reply@example.com         # ❌ ต้องตรงกับ EMAIL_USER
```

---

**เวอร์ชัน:** 1.0 | **อัพเดท:** 22 ตุลาคม 2025

