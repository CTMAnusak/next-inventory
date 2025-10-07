import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenFromRequest } from '@/lib/auth';
import { renameItemGlobally, rollbackRename, RenameResult } from '@/scripts/rename-item-global';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      console.log('❌ Token verification failed');
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }
    

    const body = await request.json();
    const { action, oldName, newName, options = {} } = body;

    // Validate required fields
    if (!action) {
      return NextResponse.json(
        { error: 'กรุณาระบุ action' },
        { status: 400 }
      );
    }

    if (action === 'rename') {
      if (!oldName || !newName) {
        return NextResponse.json(
          { error: 'กรุณาระบุชื่อเก่าและชื่อใหม่' },
          { status: 400 }
        );
      }

      if (oldName.trim() === newName.trim()) {
        return NextResponse.json(
          { error: 'ชื่อเก่าและชื่อใหม่ต้องไม่เหมือนกัน' },
          { status: 400 }
        );
      }

      // Execute global rename
      let result: RenameResult;
      try {
        result = await renameItemGlobally(
          oldName.trim(),
          newName.trim(),
          {
            dryRun: options.dryRun || false,
            createBackup: options.createBackup !== false, // default to true
            batchSize: options.batchSize || 1000
          }
        );
      } catch (scriptError) {
        console.error('❌ renameItemGlobally failed:', scriptError);
        return NextResponse.json({
          success: false,
          error: `Script execution failed: ${scriptError instanceof Error ? scriptError.message : String(scriptError)}`
        }, { status: 500 });
      }

      return NextResponse.json({
        success: result.success,
        message: result.success 
          ? `เปลี่ยนชื่อสำเร็จ: "${oldName}" → "${newName}"` 
          : 'เกิดข้อผิดพลาดในการเปลี่ยนชื่อ',
        result,
        documentsUpdated: result.documentsUpdated,
        errors: result.errors.length,
        errorDetails: result.errors
      });

    } else if (action === 'rollback') {
      const { backupId } = body;
      
      if (!backupId) {
        return NextResponse.json(
          { error: 'กรุณาระบุ backup ID' },
          { status: 400 }
        );
      }

      const success = await rollbackRename(backupId);

      return NextResponse.json({
        success,
        message: success 
          ? `กู้คืนข้อมูลสำเร็จ: ${backupId}` 
          : `เกิดข้อผิดพลาดในการกู้คืนข้อมูล: ${backupId}`
      });

    } else if (action === 'preview') {
      // Dry run to show what would be changed
      if (!oldName) {
        return NextResponse.json(
          { error: 'กรุณาระบุชื่อที่ต้องการตรวจสอบ' },
          { status: 400 }
        );
      }

      const result: RenameResult = await renameItemGlobally(
        oldName.trim(),
        'PREVIEW_MODE',
        { dryRun: true, createBackup: false }
      );

      return NextResponse.json({
        success: true,
        message: `พบข้อมูลที่จะได้รับผลกระทบ`,
        result
      });

    } else {
      return NextResponse.json(
        { error: 'Action ไม่ถูกต้อง (rename, rollback, preview)' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('❌ Rename API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'เกิดข้อผิดพลาดในระบบ',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      message: 'Item Rename API',
      description: 'API สำหรับเปลี่ยนชื่ออุปกรณ์ในระบบทั้งหมด',
      endpoints: {
        'POST /': 'เปลี่ยนชื่ออุปกรณ์',
        'actions': {
          'rename': 'เปลี่ยนชื่อ (oldName, newName, options)',
          'rollback': 'กู้คืนข้อมูล (backupId)', 
          'preview': 'ดูข้อมูลที่จะได้รับผลกระทบ (oldName)'
        }
      }
    });

  } catch (error) {
    console.error('❌ Rename API GET error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}