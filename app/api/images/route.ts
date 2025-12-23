import { NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import Image from '@/models/Image'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await dbConnect()

    // Only fetch approved (active) images, sorted by creation date (oldest to newest)
    const images = await Image.find({ status: 'approved' })
      .sort({ createdAt: 1 })
      .lean()

    return NextResponse.json(images, { status: 200 })
  } catch (error) {
    console.error('Error in GET /api/images:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
