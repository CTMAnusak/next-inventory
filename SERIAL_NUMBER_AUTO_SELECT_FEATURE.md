# Serial Number Auto-Select Feature

## Overview
This feature automatically pre-selects "อุปกรณ์ไม่มี SN" (equipment without serial numbers) when a user requests equipment without specifying a serial number.

## User Flow

### 1. User Requests Equipment
- User goes to `/equipment-request`
- Selects equipment category and item
- In the Serial Number dropdown, user selects **"ไม่มี Serial Number (ไม่เจาะจง) - มี X ชิ้น"**
- Submits the request

### 2. Admin Approves Request
- Admin goes to `/admin/equipment-reports`
- Views the pending request
- Clicks **"เลือกอุปกรณ์และอนุมัติ"** button
- Modal opens with title "เลือกอุปกรณ์ที่จะมอบหมาย"

### 3. Auto-Selection Behavior
**Before this feature:**
- Admin had to manually check the "อุปกรณ์ไม่มี SN" checkbox

**After this feature:**
- ✅ "อุปกรณ์ไม่มี SN" is **automatically checked**
- Admin can still **uncheck it** if they want to select a different item (with SN)
- Admin can also **select items with SN** instead

## Implementation Details

### Modified Files
- `src/components/SerialNumberSelector.tsx`

### Key Changes

1. **Enhanced useEffect Hook** (lines 83-98)
   - Detects when `requestedSerialNumbers` is empty, undefined, or contains only empty strings
   - Calls `autoSelectNoSerialNumber()` in such cases

2. **New Function: `autoSelectNoSerialNumber()`** (lines 196-220)
   - Automatically selects items without serial numbers
   - Respects the requested quantity
   - Uses LIFO (newest first) ordering

### Logic Flow

```typescript
// Check if user specified serial numbers
const hasRequestedSerialNumbers = requestedSerialNumbers && 
  requestedSerialNumbers.length > 0 && 
  requestedSerialNumbers.some(sn => sn && sn.trim() !== '');

if (hasRequestedSerialNumbers) {
  // User selected specific SN -> auto-select those SNs
  autoSelectRequestedSerialNumbers();
} else {
  // User selected "ไม่มี Serial Number" -> auto-select items without SN
  autoSelectNoSerialNumber();
}
```

## Testing Scenarios

### Scenario 1: User selects "ไม่มี Serial Number"
**Steps:**
1. User requests 1 Notebook without specifying SN
2. Admin opens approval modal
3. **Expected:** "อุปกรณ์ไม่มี SN" is automatically checked
4. Admin can approve directly or change the selection

### Scenario 2: User selects specific Serial Number
**Steps:**
1. User requests equipment with specific SN (e.g., "NB-001")
2. Admin opens approval modal
3. **Expected:** The specific SN "NB-001" is automatically checked (existing behavior)
4. Admin can approve directly or change the selection

### Scenario 3: Admin changes selection
**Steps:**
1. User requests equipment without SN
2. Admin opens approval modal
3. "อุปกรณ์ไม่มี SN" is auto-checked
4. Admin unchecks "อุปกรณ์ไม่มี SN"
5. Admin selects a specific SN instead
6. **Expected:** Admin can successfully change the selection and approve

### Scenario 4: Not enough items without SN
**Steps:**
1. User requests 2 items without SN
2. But only 1 item without SN is available in stock
3. **Expected:** Auto-selects 1 item (the available one), admin needs to select 1 more

## Edge Cases Handled

1. ✅ `requestedSerialNumbers` is `undefined`
2. ✅ `requestedSerialNumbers` is empty array `[]`
3. ✅ `requestedSerialNumbers` contains empty strings `[""]`
4. ✅ Not enough items without SN in stock
5. ✅ No items without SN available (function returns early)

## Benefits

1. **Saves Time:** Admin doesn't need to manually check "อุปกรณ์ไม่มี SN"
2. **Reduces Errors:** Less chance of admin forgetting to select items
3. **Maintains Flexibility:** Admin can still change the selection if needed
4. **Consistent UX:** Similar to how specific SNs are auto-selected

## Related Files
- Request creation: `src/app/equipment-request/page.tsx`
- Request API: `src/app/api/equipment-request/route.ts`
- Approval page: `src/app/admin/equipment-reports/page.tsx`
- Selection component: `src/components/SerialNumberSelector.tsx`

