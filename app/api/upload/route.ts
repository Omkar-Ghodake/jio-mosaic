import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import type { UploadApiResponse } from 'cloudinary'
import dbConnect from '@/lib/mongodb'
import Settings from '@/models/Settings'
import Image from '@/models/Image'

// ─────────────────────────────────────────────
// Cloudinary Configuration
// ─────────────────────────────────────────────

const cloudName = process.env.CLOUDINARY_CLOUD_NAME
const apiKey = process.env.CLOUDINARY_API_KEY
const apiSecret = process.env.CLOUDINARY_API_SECRET

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
})

// ─────────────────────────────────────────────
// POST Handler
// ─────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    await dbConnect()

    // 0. Cloudinary Config Check
    if (!cloudName || !apiKey || !apiSecret) {
      console.error('[Upload] Missing Cloudinary Configuration')
      return NextResponse.json(
        { success: false, error: 'Server Misconfiguration' },
        { status: 500 }
      )
    }

    // 1. Global Settings Check
    const settings = await Settings.findOne()

    const currentMode = settings?.mode ?? 'UPLOAD'
    const currentEngine = settings?.engine ?? 'AI'

    if (currentMode !== 'UPLOAD') {
      return NextResponse.json(
        {
          success: false,
          error: `Uploads are closed (Current Mode: ${currentMode})`,
        },
        { status: 403 }
      )
    }

    // 2. Read FormData
    const formData = await request.formData()

    const file = formData.get('file')
    const isPresident = formData.get('isPresident') === 'true'
    const presidentAuthId = process.env.PRESIDENT_AUTH_ID

    console.log('isPresident:', isPresident)
    console.log('presidentAuthId:', presidentAuthId)

    // 3. President Auth Validation
    if (isPresident) {
      const authId = formData.get('authId')

      if (typeof authId !== 'string' || authId !== presidentAuthId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized: Invalid President Auth ID',
          },
          { status: 403 }
        )
      }
    }

    // 4. File Validation
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file type. Only images are allowed.',
        },
        { status: 400 }
      )
    }

    // 5. Convert File → Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 6. Upload to Cloudinary (Typed, No `any`)
    const uploadResult: UploadApiResponse = await new Promise(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'jio-mosaic',
            resource_type: 'image',
          },
          (error, result) => {
            if (error) {
              reject(error)
            } else if (result) {
              resolve(result)
            }
          }
        )

        uploadStream.end(buffer)
      }
    )

    // 7. Save to MongoDB
    await Image.create({
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      isPresident,
      status: 'approved',
    })

    // 8. Success Response
    return NextResponse.json(
      { success: true, message: 'Upload successful' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in POST /api/upload:', error)
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
