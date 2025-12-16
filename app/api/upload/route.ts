import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import dbConnect from '@/lib/mongodb';
import Settings from '@/models/Settings';
import Image from '@/models/Image';

// Configure Cloudinary
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

export async function POST(request: Request) {
  try {
    await dbConnect();

    // 0. Cloudinary Config Check
    // Requirement: "403 is NOT thrown due to missing config"
    // So we throw 500 if config is missing, to distinguish from logic 403.
    if (!cloudName || !apiKey || !apiSecret) {
         console.error('[Upload] Missing Cloudinary Configuration');
         return NextResponse.json(
            { success: false, message: 'Server Misconfiguration' },
            { status: 500 }
         );
    }

    // 1. Check Global Settings
    const settings = await Settings.findOne();
    
    // Default to 'UPLOAD' if no settings
    const currentMode = settings?.mode || 'UPLOAD';
    const currentEngine = settings?.engine || 'AI';

    // Strict Mode Check: Uploads allowed ONLY in 'UPLOAD' mode
    if (currentMode !== 'UPLOAD') {
      return NextResponse.json(
        { 
            success: false, 
            message: `Uploads are closed (Current Mode: ${currentMode})` 
        },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    // 2. Validate File
    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, message: 'Invalid file type. Only images are allowed.' },
        { status: 400 }
      );
    }

    // 3. Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Upload to Cloudinary (Stream)
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'jio-mosaic',
          resource_type: 'image',
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      uploadStream.end(buffer);
    });

    // 5. Save to MongoDB
    // CANVAS ENGINE LOGIC:
    // - No AI checks
    // - No isPresident requirement checks
    // - Status = 'approved'
    // - Save ONLY: { url, publicId, status: 'approved' } (and implictly createdAt via default)
    
    if (currentEngine === 'CANVAS') {
        // Explicitly limiting fields to requirements, relying on Schema defaults for others
        await Image.create({
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            status: 'approved',
            // isPresident defaults to false in Schema
            // createdAt defaults to Date.now
        });
    } else {
        // AI ENGINE LOGIC (Legacy/Default)
        await Image.create({
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            isPresident: false,
            status: 'approved', 
        });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('Error in POST /api/upload:', error);
    return NextResponse.json(
      { success: false, message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
