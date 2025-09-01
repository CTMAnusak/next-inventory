# DatePicker Component

คอมโพเนนต์ DatePicker ที่แสดงวันที่แบบ วัน/เดือน/ปี และสามารถคลิกเลือกจากปฏิทินได้

## คุณสมบัติ

- แสดงวันที่ในรูปแบบ วัน/เดือน/ปี (dd/mm/yyyy)
- เริ่มต้นด้วยวันปัจจุบัน
- สามารถคลิกเลือกวันที่จากปฏิทินได้
- สามารถพิมพ์วันที่เองได้
- ปฏิทินภาษาไทย
- ปุ่ม "วันนี้" และ "ล้าง"

## การใช้งาน

### Import
```tsx
import DatePicker from '@/components/DatePicker';
```

### Basic Usage
```tsx
<DatePicker
  value={dateValue}
  onChange={(date) => setDate(date)}
  placeholder="dd/mm/yyyy"
  required
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | ค่าวันที่ในรูปแบบ ISO string (YYYY-MM-DD) |
| `onChange` | `(date: string) => void` | - | ฟังก์ชันที่เรียกเมื่อมีการเปลี่ยนแปลงวันที่ |
| `placeholder` | `string` | `"dd/mm/yyyy"` | ข้อความ placeholder |
| `className` | `string` | `""` | CSS classes เพิ่มเติม |
| `required` | `boolean` | `false` | กำหนดให้เป็นฟิลด์ที่จำเป็น |

### ตัวอย่างการใช้งานในฟอร์ม

```tsx
const [formData, setFormData] = useState({
  requestDate: new Date().toISOString().split('T')[0], // วันปัจจุบัน
  // ... other fields
});

// ใน JSX
<DatePicker
  value={formData.requestDate}
  onChange={(date) => setFormData(prev => ({ ...prev, requestDate: date }))}
  placeholder="dd/mm/yyyy"
  required
/>
```

## ฟีเจอร์

### การแสดงผล
- แสดงวันที่ในรูปแบบ วัน/เดือน/ปี (dd/mm/yyyy)
- ปฏิทินภาษาไทย พร้อมชื่อเดือนและวันในสัปดาห์
- ไอคอนปฏิทินด้านขวาของ input

### การเลือกวันที่
- คลิกที่ไอคอนปฏิทินเพื่อเปิดปฏิทิน
- เลือกวันที่โดยคลิกที่วันในปฏิทิน
- ปุ่มลูกศรซ้าย/ขวาเพื่อเปลี่ยนเดือน
- ปุ่ม "วันนี้" เพื่อเลือกวันปัจจุบัน
- ปุ่ม "ล้าง" เพื่อล้างค่าวันที่

### การพิมพ์วันที่
- สามารถพิมพ์วันที่เองในรูปแบบ dd/mm/yyyy
- เพิ่มเครื่องหมาย / อัตโนมัติ
- ตรวจสอบความถูกต้องของวันที่
- กด Enter เพื่อยืนยัน หรือ Escape เพื่อยกเลิก

### การจัดการ State
- เริ่มต้นด้วยวันปัจจุบันถ้าไม่มีค่า
- แปลงระหว่างรูปแบบแสดงผล (dd/mm/yyyy) และรูปแบบเก็บข้อมูล (YYYY-MM-DD)
- ปิดปฏิทินเมื่อคลิกนอกพื้นที่

## การติดตั้ง

คอมโพเนนต์นี้ใช้:
- React hooks (useState, useEffect, useRef)
- Lucide React icons
- Tailwind CSS สำหรับ styling

## การอัปเดต

คอมโพเนนต์นี้ได้ถูกอัปเดตในฟอร์มต่างๆ แล้ว:
- ฟอร์มเบิกอุปกรณ์ (`/equipment-request`)
- ฟอร์มคืนอุปกรณ์ (`/equipment-return`)
- หน้า IT Reports (Admin)
- หน้า Equipment Reports (Admin)
- หน้า Equipment Tracking (Admin)

## หมายเหตุ

- ค่าวันที่จะถูกเก็บในรูปแบบ ISO string (YYYY-MM-DD) สำหรับการส่งไปยัง API
- การแสดงผลจะเป็นรูปแบบ วัน/เดือน/ปี (dd/mm/yyyy) ตามที่ผู้ใช้คุ้นเคย
- ปฏิทินจะปิดอัตโนมัติเมื่อคลิกนอกพื้นที่หรือเลือกวันที่
