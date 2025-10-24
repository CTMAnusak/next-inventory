# 🔍 คู่มือแก้ไขปัญหา Authentication เด้งออกก่อนครบ 7 วัน

## 🚨 ปัญหาที่พบ
ระบบเด้งออกจากระบบแม้ว่าจะยังไม่ครบ 7 วัน โดยแสดง error 401 (Unauthorized) ใน console

## 🔍 สาเหตุที่เป็นไปได้

### 1. **ผู้ใช้ถูกลบจากระบบ**
- `isDeleted = true` หรือ `deletedAt` มีค่า
- ระบบจะเด้งออกทันทีเมื่อตรวจพบ

### 2. **ผู้ใช้อยู่ในสถานะรอลบ (Pending Deletion)**
- `pendingDeletion = true`
- ระบบจะเด้งออกทันทีเมื่อตรวจพบ

### 3. **JWT Token ถูกลบความถูกต้อง**
- `jwtInvalidatedAt` มีค่า
- Token ที่สร้างก่อนเวลานี้จะไม่สามารถใช้งานได้

### 4. **Token หมดอายุหรือเสียหาย**
- Token หมดอายุจริงๆ (ครบ 7 วัน)
- Token เสียหายหรือไม่ถูกต้อง

## 🛠️ วิธีตรวจสอบและแก้ไข

### ขั้นตอนที่ 1: ตรวจสอบสถานะผู้ใช้
1. เข้าไปที่หน้า `/debug-auth`
2. กดปุ่ม "ตรวจสอบสถานะ"
3. ดูผลลัพธ์ที่แสดง

### ขั้นตอนที่ 2: แก้ไขตามสถานะที่พบ

#### หากพบปัญหา `isDeleted = true` หรือ `deletedAt`:
```javascript
// ในฐานข้อมูล MongoDB
db.users.updateOne(
  { email: "ampanusak@gmail.com" },
  { 
    $unset: { 
      isDeleted: "",
      deletedAt: ""
    }
  }
);
```

#### หากพบปัญหา `pendingDeletion = true`:
```javascript
// ในฐานข้อมูล MongoDB
db.users.updateOne(
  { email: "ampanusak@gmail.com" },
  { 
    $unset: { 
      pendingDeletion: "",
      pendingDeletionReason: "",
      pendingDeletionRequestedBy: "",
      pendingDeletionRequestedAt: ""
    }
  }
);
```

#### หากพบปัญหา `jwtInvalidatedAt`:
```javascript
// ในฐานข้อมูล MongoDB
db.users.updateOne(
  { email: "ampanusak@gmail.com" },
  { 
    $unset: { 
      jwtInvalidatedAt: ""
    }
  }
);
```

### ขั้นตอนที่ 3: ล้าง Cookie และ Login ใหม่
1. เปิด Developer Tools (F12)
2. ไปที่ Application tab > Cookies
3. ลบ cookie ชื่อ `auth-token`
4. Refresh หน้าเว็บ
5. Login ใหม่

## 🔧 การแก้ไขแบบถาวร

### 1. เพิ่มการตรวจสอบในระบบ
เพิ่มการตรวจสอบสถานะผู้ใช้ก่อนแสดง error 401:

```typescript
// ใน src/app/api/auth/check/route.ts
export async function GET(request: NextRequest) {
  try {
    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // ตรวจสอบผู้ใช้ใน database
    await dbConnect();
    const { MongoClient } = require('mongodb');
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    
    await client.connect();
    const db = client.db();
    const usersCollection = db.collection('users');
    
    const user = await usersCollection.findOne({ user_id: payload.userId });
    await client.close();
    
    if (!user) {
      console.log(`❌ Auth Check: User ${payload.userId} not found in database`);
      return NextResponse.json({ 
        authenticated: false, 
        error: 'User not found' 
      }, { status: 401 });
    }

    // ตรวจสอบสถานะต่างๆ
    if (user.deletedAt || user.isDeleted) {
      console.log(`❌ Auth Check: User ${payload.userId} has been deleted`);
      return NextResponse.json({ 
        authenticated: false, 
        error: 'User has been deleted' 
      }, { status: 401 });
    }

    if (user.pendingDeletion) {
      console.log(`❌ Auth Check: User ${payload.userId} is pending deletion`);
      return NextResponse.json({ 
        authenticated: false, 
        error: 'User is pending deletion' 
      }, { status: 401 });
    }

    if (user.jwtInvalidatedAt) {
      const tokenCreatedAt = new Date(payload.iat * 1000);
      if (tokenCreatedAt < user.jwtInvalidatedAt) {
        console.log(`❌ Auth Check: JWT token invalidated for user ${payload.userId}`);
        return NextResponse.json({ 
          authenticated: false, 
          error: 'JWT token invalidated' 
        }, { status: 401 });
      }
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.user_id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        // ... other fields
      }
    });

  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ 
      authenticated: false, 
      error: 'Internal server error' 
    }, { status: 401 });
  }
}
```

### 2. เพิ่มการจัดการ Error ที่ดีขึ้น
```typescript
// ใน src/lib/auth-utils.ts
export function handleTokenExpiry(response: Response, errorMessage?: string) {
  if (response.status === 401) {
    // ลบ cookie
    document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    
    // แสดงข้อความที่ชัดเจนขึ้น
    const message = errorMessage || 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
    
    // ใช้ toast notification
    if (typeof window !== 'undefined' && (window as any).toast) {
      (window as any).toast.error(message);
    } else {
      alert(message);
    }
    
    // Redirect ไป login
    setTimeout(() => {
      window.location.href = '/login';
    }, 2000);
    
    return true;
  }
  
  return false;
}
```

## 📋 Checklist การแก้ไข

- [ ] ตรวจสอบสถานะผู้ใช้ในหน้า `/debug-auth`
- [ ] แก้ไขสถานะในฐานข้อมูลตามที่พบ
- [ ] ล้าง cookie และ login ใหม่
- [ ] ทดสอบการ login อีกครั้ง
- [ ] ตรวจสอบว่าใช้งานได้ปกติ

## 🚨 หมายเหตุสำคัญ

1. **อย่าลบข้อมูลผู้ใช้โดยไม่จำเป็น** - ตรวจสอบให้แน่ใจก่อนทำการแก้ไข
2. **สำรองข้อมูลก่อนแก้ไข** - ใช้ `db.users.find()` เพื่อดูข้อมูลก่อนแก้ไข
3. **ทดสอบหลังแก้ไข** - ตรวจสอบให้แน่ใจว่าระบบทำงานได้ปกติ

## 📞 หากยังมีปัญหา

หากยังมีปัญหาให้ตรวจสอบ:
1. Console logs ใน Developer Tools
2. Network tab ใน Developer Tools
3. ข้อมูลในฐานข้อมูล MongoDB
4. สถานะของ server และ database connection
