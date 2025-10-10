# 🔧 คู่มือแก้ปัญหา MongoDB Connection

## 🚨 ปัญหาที่พบ

แอปพลิเคชันเชื่อมต่อไปที่ **MongoDB Local** แทนที่จะเป็น **MongoDB Atlas** ทำให้:
- มี user แค่ 1 คนในระบบ (แทนที่จะเป็น 6 คน)
- เข้าสู่ระบบด้วยบัญชีอื่นไม่ได้

## 🔍 สาเหตุ

มี Environment Variable `MONGODB_URI=mongodb://127.0.0.1:27017/inventory-management` 
ตั้งค่าอยู่ใน **Windows System Environment Variables** 

Environment Variable ในระบบจะมีลำดับความสำคัญสูงกว่าไฟล์ `.env.local` 
และ dotenv จะไม่ทำการ override ค่าที่มีอยู่แล้ว

## ✅ วิธีแก้ (เลือก 1 วิธี)

### วิธีที่ 1: ลบ Environment Variable แบบถาวร (แนะนำ)

1. กด `Win + R` พิมพ์ `sysdm.cpl` แล้วกด Enter
2. คลิก tab **"Advanced"** > **"Environment Variables"**
3. ใน **User variables** หรือ **System variables** หา `MONGODB_URI`
4. คลิก **Delete** แล้วกด **OK**
5. **ปิด PowerShell/Terminal และ VS Code ทั้งหมด**
6. เปิดใหม่แล้วรัน dev server

### วิธีที่ 2: ใช้โค้ดที่แก้ไขแล้ว (ทำแล้ว ✅)

ไฟล์ `src/lib/mongodb.ts` ถูกแก้ไขให้บังคับอ่านค่าจาก `.env.local` โดยอัตโนมัติ

```typescript
// 🔧 Force load from .env.local to override system environment variables
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath, 'utf8'));
  if (envConfig.MONGODB_URI) {
    process.env.MONGODB_URI = envConfig.MONGODB_URI;
  }
}
```

## 🧪 วิธีทดสอบ

### 1. ทดสอบด้วยสคริปต์

```bash
node test-env-override.js
```

ควรแสดง:
```
✅ กำลังเชื่อมต่อไปที่ MongoDB Atlas
```

### 2. ทดสอบด้วย Dev Server

```bash
npm run dev
```

เมื่อเปิดแอป ควรเห็น console:
```
✅ MONGODB_URI loaded from .env.local
Connecting to MongoDB...
```

### 3. ตรวจสอบใน User Management

เข้าหน้า **Admin > User** 
- ควรเห็น users **6 คน** (แทนที่จะเป็น 1 คน)
- สามารถเข้าสู่ระบบด้วยบัญชีอื่นได้

## 📌 หมายเหตุ

- หากยังมีปัญหา ให้ **restart VS Code และ Terminal ทั้งหมด**
- ตรวจสอบว่าไฟล์ `.env.local` มี `MONGODB_URI` ที่ถูกต้อง (ต้องเป็น `mongodb+srv://...`)
- หากใช้ Vercel/Production ต้องตั้งค่า Environment Variables ในแพลตฟอร์มด้วย

## 🎯 ผลลัพธ์ที่คาดหวัง

✅ เชื่อมต่อ MongoDB Atlas  
✅ แสดง users ทั้ง 6 คน  
✅ เข้าสู่ระบบได้ทุกบัญชี  
✅ ข้อมูลตรงกับที่เห็นใน MongoDB Compass  

