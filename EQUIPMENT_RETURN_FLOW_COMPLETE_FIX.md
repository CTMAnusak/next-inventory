# 🔧 แก้ไขสมบูรณ์: สภาพอุปกรณ์คืนไม่ตรง

## ❌ ปัญหา

คืนอุปกรณ์สภาพ **"ชำรุด"** แต่ประวัติแสดง **"ใช้งานได้"**

## 🔍 ลำดับการทำงานและจุดที่มีบั๊ก

### 1. User กรอกฟอร์ม (`/equipment-return`)
```
User เลือก: "ชำรุด" 
→ conditionOnReturn = "cond_damaged" ✅
```

### 2. Frontend แปลง ID → ชื่อ (`equipment-return/page.tsx`)
```typescript
const conditionConfig = conditionConfigs.find(c => c.id === "cond_damaged");
// → { id: "cond_damaged", name: "ชำรุด" }

return {
  conditionOnReturn: "cond_damaged",
  conditionOnReturnName: "ชำรุด"  // ✅ ถูกต้อง
}
```

### 3. ส่งไป API (/api/equipment-return)
```json
POST /api/equipment-return
{
  "items": [{
    "conditionOnReturn": "cond_damaged",
    "conditionOnReturnName": "ชำรุด"
  }]
}
```

### 4. ❌ API ทับข้อมูล (นี่คือจุดที่มีบั๊ก!)

**โค้ดเดิม (ผิด):**
```typescript
const cleanItems = returnData.items.map((item: any) => {
  const snapshot = snapshotMap.get(item.itemId);
  
  return {
    conditionOnReturn: item.conditionOnReturn,        // "cond_damaged" ✅
    conditionOnReturnName: snapshot?.conditionName,   // "ใช้งานได้" ❌ (จาก snapshot)
  };
});
```

**ทำไมผิด:**
- `snapshot` = สถานะ**ปัจจุบัน**ของอุปกรณ์ในคลัง (ก่อนคืน)
- ถ้าอุปกรณ์ปัจจุบันสภาพ "ใช้งานได้" → `snapshot.conditionName = "ใช้งานได้"`
- แม้ user จะเลือก "ชำรุด" แต่ถูกทับโดย snapshot!

**โค้ดใหม่ (ถูกต้อง):**
```typescript
return {
  conditionOnReturn: item.conditionOnReturn,
  // 🔧 FIX: ใช้ค่าจากฟอร์มก่อน ถ้าไม่มีค่อยใช้ snapshot
  conditionOnReturnName: item.conditionOnReturnName || snapshot?.conditionName,
};
```

### 5. บันทึกลง MongoDB
```json
{
  "conditionOnReturn": "cond_damaged",
  "conditionOnReturnName": "ชำรุด"  // ✅ ถูกต้องแล้ว
}
```

### 6. แสดงในตารางประวัติ
```typescript
{(item as any).conditionOnReturnName || item.conditionOnReturn}
// → "ชำรุด" ✅
```

---

## 📋 สรุปการแก้ไขทั้งหมด

### ไฟล์ที่แก้:

1. ✅ **`src/app/equipment-return/page.tsx`**
   - เพิ่มการแปลง ID → ชื่อ ก่อนส่ง API

2. ✅ **`src/app/api/equipment-return/route.ts`**  
   - แก้ไขให้ใช้ค่าจากฟอร์มแทน snapshot

---

## 🧪 การทดสอบ

### ขั้นตอน:

1. **Restart Server**
   ```bash
   Ctrl + C
   npm run dev
   ```

2. **Hard Reload Browser**
   ```
   Ctrl + Shift + R
   ```

3. **คืนอุปกรณ์ใหม่**
   - เลือกสภาพ: **"ชำรุด"**
   - กดส่ง

4. **ตรวจสอบ Console Log** (F12)
   ```
   🔍 Config Lookup for item: Dell
     conditionOnReturn: cond_damaged
     conditionConfig found: { id: "cond_damaged", name: "ชำรุด" }
   ```

5. **ตรวจสอบ MongoDB**
   ```json
   {
     "conditionOnReturn": "cond_damaged",
     "conditionOnReturnName": "ชำรุด"  // ✅
   }
   ```

6. **ดูประวัติการคืน**
   - ควรแสดง: **"ชำรุด"** ✅

---

## ✅ ผลลัพธ์ที่คาดหวัง

| | **ก่อนแก้** | **หลังแก้** |
|---|---|---|
| User เลือก | ชำรุด | ชำรุด |
| Frontend ส่ง | `conditionOnReturnName: "ชำรุด"` | `conditionOnReturnName: "ชำรุด"` |
| API บันทึก | ❌ `"ใช้งานได้"` (ถูกทับ) | ✅ `"ชำรุด"` |
| ประวัติแสดง | ❌ "ใช้งานได้" | ✅ "ชำรุด" |

---

**พร้อมทดสอบแล้ว!** 🎉

