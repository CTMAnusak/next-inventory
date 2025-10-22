# ⚡ Quick Start: เปลี่ยน Google OAuth Credentials

## 🚀 ขั้นตอนแบบย่อ

### ✅ ขั้นตอนที่ 1: สร้าง OAuth Client ID

1. ไปที่: https://console.cloud.google.com/
2. เลือกหรือสร้าง Project
3. ไปที่ **APIs & Services** → **Credentials**
4. คลิก **+ CREATE CREDENTIALS** → **OAuth client ID**
5. เลือก **Web application**
6. กรอกข้อมูล:

```
Name: Next Inventory Web Client

Authorized JavaScript origins:
http://localhost:3000

Authorized redirect URIs: (สำคัญมาก!)
http://localhost:3000/api/auth/callback/google
```

7. คลิก **CREATE**
8. **คัดลอก Client ID และ Client Secret**

---

### ✅ ขั้นตอนที่ 2: แก้ไขไฟล์ `.env.local`

```env
# Google OAuth Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=689507743564-xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
```

**แทนที่:**
- `689507743564-xxx...` = Client ID ที่คัดลอกมา
- `GOCSPX-xxx...` = Client Secret ที่คัดลอกมา

---

### ✅ ขั้นตอนที่ 3: Restart Server

```bash
# หยุด server (Ctrl+C)
npm run dev
```

---

## 🧪 ทดสอบ

1. เปิด http://localhost:3000
2. คลิก **Login with Google**
3. เลือกบัญชี Google
4. ควร Login ได้สำเร็จ

---

## ❌ แก้ปัญหาด่วน

### Error: "redirect_uri_mismatch"
**วิธีแก้:** ตรวจสอบว่าใน Google Cloud Console ใส่:
```
http://localhost:3000/api/auth/callback/google
```
(ต้องมี `/api/auth/callback/google` ด้านหลัง)

### Error: "This app's request is invalid"
**วิธีแก้:** ตั้งค่า OAuth Consent Screen ก่อน:
- ไปที่ **OAuth consent screen**
- เลือก **External**
- กรอกข้อมูลพื้นฐาน
- **SAVE**

### Login ไม่ได้
**ตรวจสอบ:**
- ✅ Client ID/Secret ถูกต้อง
- ✅ Restart server แล้ว
- ✅ Redirect URI ตรงกัน

---

## 🔒 สำคัญ!

⚠️ **อย่าแชร์ Client Secret** กับใครก็ตาม  
⚠️ **อย่าอัพโหลด `.env.local` ขึ้น Git**

---

## 📖 อ่านคู่มือฉบับเต็ม

ดูรายละเอียดเพิ่มเติมใน: **GOOGLE_OAUTH_SETUP_GUIDE.md**

---

## 📋 Redirect URI ที่ถูกต้อง

```
✅ ถูกต้อง:
http://localhost:3000/api/auth/callback/google
https://yourdomain.com/api/auth/callback/google

❌ ผิด:
http://localhost:3000/
http://localhost:3000/api/auth/callback
http://localhost:3000/callback/google
```

---

## 🌐 Production (ใช้ URL จริง)

เพิ่ม URL Production ใน Google Cloud Console:

```
Authorized JavaScript origins:
https://yourdomain.com

Authorized redirect URIs:
https://yourdomain.com/api/auth/callback/google
```

แล้วตั้งค่าใน Production Environment:
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
NEXTAUTH_URL=https://yourdomain.com
```

---

**เวอร์ชัน:** 1.0 | **อัพเดท:** 22 ตุลาคม 2025

