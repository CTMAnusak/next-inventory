# Available Quantity Fix Summary

## Problem
The "จำนวนที่เบิกได้" (Available to Issue) column was showing **0** instead of **4** for "Mouse Logitech", even though the breakdown showed:
- Status "มี" (Available): 5 items
- Condition "ใช้งานได้" (Working): 4 items
- Condition "ชำรุด" (Damaged): 1 item

## Root Cause Analysis

The issue was caused by **confusion about what data the breakdown popup displays**:

### Before Fix:
- The breakdown popup showed **TOTAL counts** (Admin Stock + User Owned combined)
- The "Available to Issue" column only counts **Admin Stock** items
- This discrepancy confused users

### Calculation Logic (Correct):
```typescript
availableQuantity = count of items where:
  - currentOwnership.ownerType === 'admin_stock' AND
  - statusId === 'status_available' AND  
  - conditionId === 'cond_working'
```

## Possible Scenarios

### Scenario 1: All items are User Owned
```
- Total items with status "มี": 5 (all User Owned)
- Total items with condition "ใช้งานได้": 4 (all User Owned)
- Admin Stock items: 0

Available to Issue: 0 ✅ (Correct - no items in admin stock)
```

### Scenario 2: Mixed ownership
```
- Admin Stock (status "มี" + condition "ใช้งานได้"): 2
- User Owned (status "มี" + condition "ใช้งานได้"): 2
- Admin Stock (status "มี" + condition "ชำรุด"): 1

Available to Issue: 2 ✅ (Only admin stock working items)
```

### Scenario 3: Missing conditionId
```
- Admin Stock items: 5
- Items with statusId "status_available": 5
- Items with conditionId === undefined: 5

Available to Issue: 0 ❌ (Bug - should be fixed by migration)
```

## Fixes Implemented

### 1. Updated Breakdown Popup Display
**File:** `src/components/StatusCell.tsx`

**Changes:**
- Separated display of **Admin Stock** and **User Owned** breakdowns
- Added explanation: "จำนวนที่เบิกได้ = Admin Stock + Status 'มี' + Condition 'ใช้งานได้'"
- Shows both categories when applicable

**Result:**
```
💡 จำนวนที่เบิกได้ = Admin Stock + สถานะ "มี" + สภาพ "ใช้งานได้"

สถานะอุปกรณ์ (Admin Stock):
• มี: X items

สภาพอุปกรณ์ (Admin Stock):  
• ใช้งานได้: Y items

[User Owned section shown if applicable]
```

### 2. Enhanced Debug Logging
**File:** `src/lib/inventory-helpers.ts`

**Changes:**
- Added logging when `availableQuantity = 0` but `adminStock > 0`
- Shows status and condition breakdown
- Detects items with null/undefined `conditionId`

**Log Example:**
```
⚠️  Mouse Logitech: availableQuantity=0 but adminStock=5
   Status breakdown: { status_available: 5 }
   Condition breakdown: { undefined: 5 }
   ⚠️  5 items have null/undefined conditionId
```

### 3. Migration Script
**File:** `fix-missing-condition-ids.js`

**Purpose:**
- Find items with null/undefined `conditionId`
- Set default `conditionId = 'cond_working'`
- Recalculate and update InventoryMaster

**Usage:**
```bash
node fix-missing-condition-ids.js
```

## How to Verify the Fix

### Step 1: Check the Popup
1. Navigate to Admin Inventory page
2. Click the ℹ️ icon next to any item
3. Verify the popup shows:
   - Separate "Admin Stock" and "User Owned" sections
   - Explanation at the top
   - Correct counts

### Step 2: Check Console Logs
1. Open Browser Console (F12)
2. Click "รีเฟรช" button
3. Look for debug logs showing calculations

### Step 3: Verify Available Quantity
1. Check "จำนวนที่เบิกได้" column
2. Compare with Admin Stock breakdown
3. Should match: Admin items with (status "มี" + condition "ใช้งานได้")

## Files Modified

1. **src/components/StatusCell.tsx**
   - Separated Admin Stock and User Owned display
   - Added calculation explanation

2. **src/lib/inventory-helpers.ts**
   - Added debug logging for troubleshooting
   - Better error detection

3. **fix-missing-condition-ids.js** (New)
   - Migration script to fix legacy data

4. **AVAILABLE_QUANTITY_FIX_GUIDE.md** (New)
   - Comprehensive Thai language guide

5. **AVAILABLE_QUANTITY_FIX_SUMMARY.md** (New)
   - This English summary

## Testing Checklist

- [ ] Popup shows separate Admin Stock / User Owned sections
- [ ] Popup shows calculation explanation
- [ ] "จำนวนที่เบิกได้" matches Admin Stock (status "มี" + condition "ใช้งานได้")
- [ ] Console logs show correct calculations
- [ ] No warnings about missing conditionId
- [ ] Refresh button updates data correctly

## Next Steps for User

1. **Deploy the changes** to production
2. **Run migration script** if needed:
   ```bash
   # Update connection string in script first
   node fix-missing-condition-ids.js
   ```
3. **Click "รีเฟรช" button** in Admin Inventory
4. **Verify** the "จำนวนที่เบิกได้" is now correct
5. **Check the popup** to understand breakdown by ownership

## Technical Notes

### Why the confusion happened:
- The original breakdown API aggregated ALL items (line 41-72 in `breakdown/route.ts`)
- The popup displayed total counts without distinguishing ownership
- Users expected "Available to Issue" to match total "Working" items
- But it only counts Admin Stock working items

### Why the fix works:
- Shows Admin Stock counts separately (what affects "Available to Issue")
- Shows User Owned counts separately (not available to issue)
- Adds clear explanation of calculation
- Fixes legacy data with missing conditionId

---

**Date:** October 27, 2025
**Version:** 1.0
**Status:** Ready for deployment

