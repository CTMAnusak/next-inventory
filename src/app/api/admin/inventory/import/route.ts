import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenFromRequest } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import InventoryConfig from '@/models/InventoryConfig';
import { createInventoryItem } from '@/lib/inventory-helpers';
import { clearAllCaches } from '@/lib/cache-utils';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Verify authentication
    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'กรุณาส่งข้อมูลรายการที่จะนำเข้า' },
        { status: 400 }
      );
    }

    // Get configs for validation
    const config = await InventoryConfig.findOne({});
    if (!config) {
      return NextResponse.json(
        { error: 'ไม่พบการตั้งค่าระบบ' },
        { status: 500 }
      );
    }

    const categoryConfigs = config.categoryConfigs || [];
    const statusConfigs = config.statusConfigs || [];
    const conditionConfigs = config.conditionConfigs || [];

    // Helper functions to find IDs from names
    const getCategoryIdFromName = (categoryName: string): string | null => {
      const category = categoryConfigs.find((c: any) => c.name === categoryName);
      return category?.id || null;
    };

    const getStatusIdFromName = (statusName: string): string | null => {
      const status = statusConfigs.find((s: any) => s.name === statusName);
      return status?.id || statusConfigs.find((s: any) => s.id === statusName)?.id || null;
    };

    const getConditionIdFromName = (conditionName: string): string | null => {
      const condition = conditionConfigs.find((c: any) => c.id === conditionName || c.name === conditionName);
      return condition?.id || null;
    };

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; itemName: string; error: string }>,
    };

    // Process each item
    for (const item of items) {
      const { rowNumber, category, itemName, quantity, status, condition, serialNumber, phoneNumber } = item;

      try {
        // Validate required fields
        if (!itemName || !itemName.trim()) {
          results.failed++;
          results.errors.push({
            row: rowNumber || 0,
            itemName: itemName || '',
            error: 'กรุณาระบุชื่ออุปกรณ์',
          });
          continue;
        }

        if (!category || !category.trim()) {
          results.failed++;
          results.errors.push({
            row: rowNumber || 0,
            itemName: itemName || '',
            error: 'กรุณาระบุหมวดหมู่',
          });
          continue;
        }

        // Get category ID
        const categoryId = getCategoryIdFromName(category.trim());
        if (!categoryId) {
          results.failed++;
          results.errors.push({
            row: rowNumber || 0,
            itemName: itemName || '',
            error: `ไม่พบหมวดหมู่ "${category}" ในระบบ`,
          });
          continue;
        }

        // Get status ID (default to 'status_available' if not provided)
        let statusId = 'status_available';
        if (status && status.trim()) {
          const foundStatusId = getStatusIdFromName(status.trim());
          if (foundStatusId) {
            statusId = foundStatusId;
          } else {
            // Try to use as ID directly
            statusId = status.trim();
          }
        }

        // Get condition ID (default to 'cond_working' if not provided)
        let conditionId = 'cond_working';
        if (condition && condition.trim()) {
          const foundConditionId = getConditionIdFromName(condition.trim());
          if (foundConditionId) {
            conditionId = foundConditionId;
          } else {
            // Try to use as ID directly
            conditionId = condition.trim();
          }
        }

        // Validate phone number format if provided
        if (phoneNumber && phoneNumber.trim()) {
          const phoneRegex = /^[0-9]{10}$/;
          if (!phoneRegex.test(phoneNumber.trim())) {
            results.failed++;
            results.errors.push({
              row: rowNumber || 0,
              itemName: itemName || '',
              error: 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก',
            });
            continue;
          }
        }

        // Determine quantity
        const hasSerialNumber = serialNumber && serialNumber.trim() !== '';
        const hasPhoneNumber = phoneNumber && phoneNumber.trim() !== '';
        const actualQuantity = hasSerialNumber || hasPhoneNumber ? 1 : (parseInt(quantity) || 1);

        if (actualQuantity <= 0) {
          results.failed++;
          results.errors.push({
            row: rowNumber || 0,
            itemName: itemName || '',
            error: 'จำนวนต้องมากกว่า 0',
          });
          continue;
        }

        // Create items
        const itemsToCreate = [];
        
        if (hasSerialNumber || hasPhoneNumber) {
          // Create single item with serial number or phone number
          itemsToCreate.push({
            itemName: itemName.trim(),
            categoryId,
            serialNumber: hasSerialNumber ? serialNumber.trim() : undefined,
            numberPhone: hasPhoneNumber ? phoneNumber.trim() : undefined,
            statusId,
            conditionId,
            addedBy: 'admin' as const,
            initialOwnerType: 'admin_stock' as const,
            notes: `Imported from Excel${hasPhoneNumber ? ' (SIM card)' : ''}`,
          });
        } else {
          // Create multiple items without serial numbers or phone numbers
          for (let i = 0; i < actualQuantity; i++) {
            itemsToCreate.push({
              itemName: itemName.trim(),
              categoryId,
              statusId,
              conditionId,
              addedBy: 'admin' as const,
              initialOwnerType: 'admin_stock' as const,
              notes: `Imported from Excel (${i + 1}/${actualQuantity})`,
            });
          }
        }

        // Create all items
        for (const itemToCreate of itemsToCreate) {
          try {
            await createInventoryItem(itemToCreate);
            results.success++;
          } catch (createError: any) {
            // Check if it's a duplicate error
            if (createError.message?.includes('Serial Number') || createError.message?.includes('เบอร์โทร')) {
              results.failed++;
              results.errors.push({
                row: rowNumber || 0,
                itemName: itemName || '',
                error: createError.message || 'ข้อมูลซ้ำ',
              });
            } else {
              throw createError;
            }
          }
        }
      } catch (error: any) {
        console.error(`Error processing item ${itemName}:`, error);
        results.failed++;
        results.errors.push({
          row: rowNumber || 0,
          itemName: itemName || '',
          error: error.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ',
        });
      }
    }

    // Clear cache after import
    clearAllCaches();

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล', message: error.message },
      { status: 500 }
    );
  }
}

