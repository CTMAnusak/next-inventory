# 🔐 คู่มือการตั้งค่า Google OAuth (Login ด้วย Google)

## 🎯 ภาพรวม

Google OAuth ใช้สำหรับให้ผู้ใช้ Login ด้วยบัญชี Google ในระบบ Next Inventory Management

---

## 📝 ขั้นตอนการสร้าง Google OAuth Credentials

### **ขั้นตอนที่ 1: เข้าสู่ Google Cloud Console**

1. ไปที่ https://console.cloud.google.com/
2. เข้าสู่ระบบด้วยบัญชี Google ของคุณ

---

### **ขั้นตอนที่ 2: สร้างหรือเลือก Project**

#### กรณีที่ 1: สร้าง Project ใหม่

1. คลิกที่ **Select a project** (ด้านบนซ้าย)
2. คลิก **NEW PROJECT**
3. ตั้งชื่อ Project เช่น `Next Inventory System`
4. คลิก **CREATE**
5. รอสักครู่จนกว่า Project จะถูกสร้างเสร็จ

#### กรณีที่ 2: ใช้ Project ที่มีอยู่

1. คลิกที่ **Select a project** (ด้านบนซ้าย)
2. เลือก Project ที่ต้องการใช้

---

### **ขั้นตอนที่ 3: เปิดใช้งาน Google+ API (ถ้าจำเป็น)**

1. ไปที่ **APIs & Services** → **Library**
2. ค้นหา **"Google+ API"**
3. คลิกและเลือก **ENABLE** (ถ้ายังไม่ได้เปิด)

---

### **ขั้นตอนที่ 4: ตั้งค่า OAuth Consent Screen**

1. ไปที่ **APIs & Services** → **OAuth consent screen**

2. เลือก **User Type:**
   - ✅ **External** (แนะนำ) - ใครก็ Login ได้
   - หรือ **Internal** - เฉพาะคนในองค์กร (ต้องมี Google Workspace)

3. คลิก **CREATE**

4. **กรอกข้อมูล OAuth consent screen:**
   ```
   App name: Next Inventory Management System
   User support email: อีเมลของคุณ
   Application home page: http://localhost:3000 (หรือ URL จริง)
   
   Developer contact information:
   Email addresses: อีเมลของคุณ
   ```

5. คลิก **SAVE AND CONTINUE**

6. **Scopes:** (ข้ามขั้นตอนนี้ได้)
   - คลิก **SAVE AND CONTINUE**

7. **Test users:** (สำหรับ External Mode)
   - ถ้าต้องการให้เฉพาะบางคน Login ได้ระหว่างพัฒนา
   - คลิก **+ ADD USERS** และใส่อีเมลที่อนุญาต
   - หรือข้ามขั้นตอนนี้ก็ได้
   - คลิก **SAVE AND CONTINUE**

8. **Summary:**
   - ตรวจสอบข้อมูล
   - คลิก **BACK TO DASHBOARD**

---

### **ขั้นตอนที่ 5: สร้าง OAuth 2.0 Client ID**

1. ไปที่ **APIs & Services** → **Credentials**

2. คลิก **+ CREATE CREDENTIALS** → เลือก **OAuth client ID**

3. **Application type:** เลือก **Web application**

4. **ตั้งชื่อ:**
   ```
   Name: Next Inventory Web Client
   ```

5. **Authorized JavaScript origins:**
   ```
   http://localhost:3000
   https://yourdomain.com        (ถ้ามี production URL)
   ```
   
   คลิก **+ ADD URI** เพื่อเพิ่มหลาย URL

6. **Authorized redirect URIs:** (สำคัญมาก!)
   ```
   http://localhost:3000/api/auth/callback/google
   https://yourdomain.com/api/auth/callback/google        (ถ้ามี production URL)
   ```
   
   ⚠️ **ต้องใส่ `/api/auth/callback/google` ด้านหลัง URL เสมอ!**
   
   คลิก **+ ADD URI** เพื่อเพิ่มหลาย URL

7. คลิก **CREATE**

---

### **ขั้นตอนที่ 6: คัดลอก Credentials**

หลังจากสร้างเสร็จ จะเห็น Popup แสดง:

```
Your Client ID
689507743564-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com

Your Client Secret  
GOCSPX-xxxxxxxxxxxxxxxxxxxx
```

📋 **คัดลอกทั้ง 2 ค่าไว้** (จะใช้ในขั้นตอนถัดไป)

> 💡 **หมายเหตุ:** คุณสามารถกลับมาดูค่าเหล่านี้ได้ทุกเมื่อที่ **APIs & Services** → **Credentials**

---

### **ขั้นตอนที่ 7: แก้ไขไฟล์ `.env.local`**

1. เปิดไฟล์ `.env.local` ในโฟลเดอร์โปรเจค (ถ้าไม่มีให้สร้างใหม่)

2. เพิ่มหรือแก้ไขค่าเหล่านี้:

```env
# Google OAuth Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=689507743564-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
```

**แทนที่:**
- `689507743564-xxx...` → Client ID ที่คัดลอกมา
- `GOCSPX-xxx...` → Client Secret ที่คัดลอกมา

**ตัวอย่างจริง:**
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=689507743564-msuhgr7sbljam4oegkc804oq0q38q6m0.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

3. บันทึกไฟล์

---

### **ขั้นตอนที่ 8: Restart Server**

```bash
# หยุด server (กด Ctrl+C ในหน้าต่าง terminal)

# รันใหม่
npm run dev
```

---

## 🧪 วิธีทดสอบ

### 1. เปิดเว็บไซต์
```
http://localhost:3000
```

### 2. ไปที่หน้า Login
- คลิกปุ่ม **Login with Google** หรือ **เข้าสู่ระบบด้วย Google**

### 3. ทดสอบ Login
- เลือกบัญชี Google
- อนุญาตให้แอปเข้าถึงข้อมูล
- ควรจะ Login เข้าระบบได้สำเร็จ

---

## 🔄 การใช้งาน Production (Deploy จริง)

เมื่อ Deploy ขึ้น Production (เช่น Vercel, Netlify):

### 1. เพิ่ม Production URL ใน Google Cloud Console

ไปที่ **APIs & Services** → **Credentials** → เลือก OAuth Client:

**Authorized JavaScript origins:**
```
https://yourdomain.com
https://www.yourdomain.com
```

**Authorized redirect URIs:**
```
https://yourdomain.com/api/auth/callback/google
https://www.yourdomain.com/api/auth/callback/google
```

คลิก **SAVE**

### 2. ตั้งค่า Environment Variables ใน Production

ไปที่ Platform ที่ Deploy (Vercel/Netlify):

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-secret-key
```

---

## ❌ แก้ปัญหาที่พบบ่อย

### ปัญหา 1: "Redirect URI mismatch"

**ข้อความ Error:**
```
Error 400: redirect_uri_mismatch
```

**สาเหตุ:** Redirect URI ไม่ตรงกับที่ตั้งไว้ใน Google Cloud Console

**วิธีแก้:**
1. ตรวจสอบ URL ที่ระบบพยายามใช้ใน error message
2. ไปที่ Google Cloud Console → Credentials
3. แก้ไข OAuth Client และเพิ่ม Redirect URI ที่ถูกต้อง:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
4. คลิก **SAVE** และลองใหม่

### ปัญหา 2: "Access blocked: This app's request is invalid"

**สาเหตุ:** ยังไม่ได้ตั้งค่า OAuth Consent Screen

**วิธีแก้:**
- กลับไปทำขั้นตอนที่ 4 (ตั้งค่า OAuth Consent Screen)

### ปัญหา 3: "This app hasn't been verified"

**สาเหตุ:** App ยังอยู่ในโหมด Testing

**วิธีแก้:**
- กด **Continue** เพื่อใช้งานต่อ (สำหรับ Testing)
- หรือไปที่ OAuth Consent Screen และเปลี่ยนเป็น **PUBLISH APP** (สำหรับ Production)

### ปัญหา 4: Client ID ไม่ทำงาน

**วิธีแก้:**
1. ตรวจสอบว่าค่าใน `.env.local` ถูกต้อง
2. ตรวจสอบว่าไม่มีช่องว่างหรืออักขระแปลกปลอม
3. Restart server
4. ล้าง cache ของ browser (Ctrl+Shift+Delete)

### ปัญหา 5: "Invalid_client" error

**สาเหตุ:** Client Secret ไม่ถูกต้อง

**วิธีแก้:**
1. ไปที่ Google Cloud Console → Credentials
2. ดู Client Secret อีกครั้ง (หรือสร้างใหม่)
3. คัดลอกและวางใน `.env.local`
4. Restart server

---

## 🔒 ความปลอดภัย

### ⚠️ ข้อควรระวัง

1. **อย่าแชร์ Client Secret** กับใครก็ตาม
2. **อย่าอัพโหลด `.env.local` ขึ้น Git** (ถูก ignore อยู่แล้ว)
3. **อย่า commit Client Secret** ลงใน repository
4. **ใช้ Client ID/Secret แยกระหว่าง Development และ Production**

### ✅ Best Practices

1. **สร้าง OAuth Client แยก** สำหรับ Development และ Production
2. **ตั้งชื่อ OAuth Client ให้ชัดเจน** เพื่อจัดการง่าย
3. **จำกัด Redirect URIs** ให้เฉพาะ URL ที่ใช้จริง
4. **ตรวจสอบ OAuth Consent Screen** ให้ครบถ้วน
5. **ใช้ Environment Variables** สำหรับ production deployment

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
NEXT_PUBLIC_GOOGLE_CLIENT_ID=689507743564-msuhgr7sbljam4oegkc804oq0q38q6m0.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

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

## 📸 ภาพประกอบ (ขั้นตอนสำคัญ)

### Authorized redirect URIs (ต้องใส่ให้ถูก):
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

## 🔗 ลิงก์ที่เป็นประโยชน์

- [Google Cloud Console](https://console.cloud.google.com/)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [NextAuth.js Google Provider](https://next-auth.js.org/providers/google)

---

## 📞 ต้องการความช่วยเหลือเพิ่มเติม?

หากมีปัญหาหรือข้อสงสัย:

1. ตรวจสอบ Console Log ใน Terminal
2. ตรวจสอบ Browser Console (F12)
3. ดู error message ที่แสดง
4. ตรวจสอบว่า Redirect URI ตรงกัน

---

**อัพเดทล่าสุด:** วันที่ 22 ตุลาคม 2025  
**เวอร์ชัน:** 1.0  
**ผู้จัดทำ:** Next Inventory Management System

