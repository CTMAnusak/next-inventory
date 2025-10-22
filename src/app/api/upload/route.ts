import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'uploads';

    if (!file) {
      return NextResponse.json(
        { error: 'ไม่พบไฟล์ที่อัพโหลด' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'ประเภทไฟล์ไม่ถูกต้อง กรุณาอัพโหลดไฟล์รูปภาพ' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'ขนาดไฟล์เกิน 10MB' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Resize image with sharp for space optimization
    let processedBuffer: Buffer;
    try {
      processedBuffer = await sharp(buffer)
        .resize(1280, 720, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({
          quality: 75,
          progressive: true
        })
        .toBuffer();
    } catch (error) {
      console.error('Image processing error:', error);
      // If sharp fails, use original buffer
      processedBuffer = buffer;
    }

    // Generate unique filename (always .jpg after processing)
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const filename = `${timestamp}_${randomString}.jpg`;

    // Create upload directory
    const uploadDir = path.join(process.cwd(), 'public', 'assets', folder);
    
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Save processed file
    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, processedBuffer);

    return NextResponse.json({
      message: 'อัพโหลดไฟล์สำเร็จ',
      filename: filename,
      filepath: `/assets/${folder}/${filename}`
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัพโหลดไฟล์' },
      { status: 500 }
    );
  }
}
