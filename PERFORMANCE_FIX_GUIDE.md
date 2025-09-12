# คู่มือแก้ไขปัญหาการแฮง/ติดของระบบ

## 🔍 สาเหตุหลักที่ทำให้ระบบแฮง

### 1. **Database Query ที่ไม่มีประสิทธิภาพ**
- ไม่มี Index ที่เหมาะสม
- การใช้ `Promise.all` กับ `User.findOne` ใน loop
- การ query โดยไม่จำกัด field ที่ต้องการ

### 2. **Frontend Performance Issues**
- การ re-render ซ้ำๆ ใน React components
- ไม่มี timeout สำหรับ API calls
- การไม่ใช้ memoization

### 3. **API Routes ที่ช้า**
- การดึงข้อมูล user profile แบบ sequential
- การไม่ใช้ lean() queries
- การไม่จำกัด field ที่ return

## ✅ การแก้ไขที่ทำไปแล้ว

### 1. **ปรับปรุง Admin Equipment Reports API**
```javascript
// เปลี่ยนจาก Sequential User Lookups
const enhancedLogs = await Promise.all(
  userOwnedLogs.map(async (log) => {
    const userProfile = await User.findOne({ user_id: log.userId });
    // ...
  })
);

// เป็น Batch User Lookups
const userIds = [...new Set(userOwnedLogs.filter(log => log.userId).map(log => log.userId))];
const userProfiles = await User.find({ user_id: { $in: userIds } });
const userProfileMap = new Map();
userProfiles.forEach(profile => {
  userProfileMap.set(profile.user_id, profile);
});
```

### 2. **ปรับปรุง User Owned Equipment API**
```javascript
// เพิ่ม lean() และ select() เพื่อลด memory usage
const userOwnedInventoryItems = await InventoryItem.find({
  'currentOwnership.ownerType': 'user_owned',
  'currentOwnership.userId': userIdToFind
})
.select('itemName category serialNumber currentOwnership _id')
.lean();
```

### 3. **ปรับปรุง Dashboard Frontend**
```javascript
// เพิ่ม useCallback และ useMemo
const fetchOwned = useCallback(async () => {
  // เพิ่ม timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  const ownedRes = await fetch(`/api/user/owned-equipment?${withUserId.toString()}`, {
    signal: controller.signal
  });
  // ...
}, [user?.firstName, user?.lastName, user?.office, user?.id]);

const quickActions = useMemo(() => [...], []);
```

### 4. **เพิ่ม Timeout Protection**
- เพิ่ม AbortController ใน API calls
- เพิ่ม timeout 30 วินาทีสำหรับ fetch requests
- เพิ่ม error handling สำหรับ timeout

## 🚀 วิธีการใช้งาน Scripts ที่สร้างให้

### 1. **สร้าง Database Indexes เพื่อเพิ่มความเร็ว**
```bash
node optimize-database-indexes.js
```

### 2. **ตรวจสอบประสิทธิภาพระบบ**
```bash
node performance-monitor.js
```

## 📊 Database Indexes ที่แนะนำ

### InventoryItems Collection
```javascript
// Index สำหรับ user-owned equipment queries
{ 'currentOwnership.ownerType': 1, 'currentOwnership.userId': 1 }

// Index สำหรับ serial number lookups
{ 'serialNumber': 1 }

// Index สำหรับ item name + category
{ 'itemName': 1, 'category': 1 }
```

### Users Collection
```javascript
// Index สำหรับ user_id lookups (unique)
{ 'user_id': 1 }

// Index สำหรับ pendingDeletion flag
{ 'pendingDeletion': 1 }
```

### RequestLogs Collection
```javascript
// Index สำหรับ user + request type
{ 'userId': 1, 'requestType': 1 }

// Index สำหรับ user name + office
{ 'firstName': 1, 'lastName': 1, 'office': 1 }

// Index สำหรับ creation date sorting
{ 'createdAt': -1 }
```

## ⚡ ผลลัพธ์ที่คาดหวัง

### ก่อนการแก้ไข
- Dashboard loading: 10-30+ วินาที หรือแฮง
- Equipment Reports: 5-15+ วินาที
- User Owned Equipment API: ช้าเนื่องจาก sequential queries

### หลังการแก้ไข  
- Dashboard loading: 2-5 วินาที
- Equipment Reports: 1-3 วินาที
- User Owned Equipment API: < 1 วินาที
- มี timeout protection ป้องกันการแฮง

## 🔧 การ Monitor และ Debug เพิ่มเติม

### 1. **ตรวจสอบ MongoDB Performance**
```javascript
// ใน MongoDB shell
db.setProfilingLevel(2, { slowms: 100 });
db.system.profile.find().sort({ ts: -1 }).limit(5);
```

### 2. **ตรวจสอบ Memory Usage**
```javascript
// ใน Node.js application
console.log('Memory usage:', process.memoryUsage());
```

### 3. **Monitor API Response Times**
```javascript
// ใน browser console
performance.getEntriesByType('navigation');
performance.getEntriesByType('resource');
```

## 🎯 Best Practices ที่นำมาใช้

1. **Database Level**
   - ใช้ appropriate indexes
   - ใช้ lean() queries สำหรับ read-only operations
   - ใช้ field selection เพื่อลดข้อมูลที่ transfer
   - ใช้ batch operations แทน individual queries

2. **API Level**
   - เพิ่ม timeout controls
   - ใช้ AbortController
   - จำกัด response size
   - Cache ข้อมูลที่เหมาะสม

3. **Frontend Level**
   - ใช้ useCallback และ useMemo
   - หลีกเลี่ยง unnecessary re-renders
   - เพิ่ม loading states
   - Error handling ที่ดี

## 🚨 Warning Signs ที่ต้องระวัง

1. **API calls ที่ใช้เวลา > 5 วินาที**
2. **Memory usage เพิ่มขึ้นเรื่อยๆ**
3. **Database connections ที่ไม่ปิด**
4. **Infinite re-render loops**
5. **Large collection scans ใน MongoDB**

## 📋 TODO สำหรับการปรับปรุงเพิ่มเติม

1. ⬜ เพิ่ม Connection Pooling สำหรับ MongoDB
2. ⬜ ใช้ Redis สำหรับ Cache layer
3. ⬜ เพิ่ม API Rate Limiting
4. ⬜ ใช้ Virtual Scrolling สำหรับ large tables
5. ⬜ เพิ่ม Background Tasks สำหรับ heavy operations
