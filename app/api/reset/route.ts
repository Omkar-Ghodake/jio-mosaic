import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import dbConnect from '@/lib/mongodb';
import Image from '@/models/Image';
import Settings from '@/models/Settings';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST() {
  try {
    await dbConnect();

    // 1. Fetch all images to get publicIds
    const images = await Image.find({});

    // 2. Delete from Cloudinary
    const deletePromises = images.map((img) => {
      return new Promise((resolve) => {
        cloudinary.uploader.destroy(img.publicId, (error, result) => {
          if (error) console.error(`Failed to delete ${img.publicId}:`, error);
          resolve(result);
        });
      });
    });
    
    // Wait for all cloud deletes (don't fail the request if one fails, just log)
    await Promise.all(deletePromises);

    // 3. Delete all from MongoDB
    await Image.deleteMany({});

    // 4. Reset Settings Mode
    await Settings.findOneAndUpdate(
      {},
      { mode: 'UPLOAD' },
      { upsert: true }
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error in POST /api/reset:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
