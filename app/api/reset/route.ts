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

export async function POST(req: Request) {
  try {
    const { mode } = await req.json().catch(() => ({ mode: 'SOFT' })) // Default to SOFT if no body
    await dbConnect();

    // HARD RESET (Destructive)
    if (mode === 'HARD') {
        const images = await Image.find({});
        // Cloudinary Delete
        const deletePromises = images.map((img) => {
        return new Promise((resolve) => {
            cloudinary.uploader.destroy(img.publicId, (error, result) => {
            if (error) console.error(`Failed to delete ${img.publicId}:`, error);
            resolve(result);
            });
        });
        });
        await Promise.all(deletePromises);
        
        // Mongo Delete
        await Image.deleteMany({});
    } else {
        // SOFT RESET (Safe)
        // Mark active images as archived
        await Image.updateMany(
            { status: 'approved' },
            { $set: { status: 'archived' } }
        )
    }

    // Reset System Mode (Common for both)
    await Settings.findOneAndUpdate(
      {},
      { mode: 'UPLOAD' },
      { upsert: true }
    );

    return NextResponse.json({ success: true, mode }, { status: 200 });
  } catch (error) {
    console.error('Error in POST /api/reset:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
