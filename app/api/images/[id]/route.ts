import { NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import Image from '@/models/Image'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { action } = await request.json()

    await dbConnect()

    if (action === 'archive') {
      const updatedImage = await Image.findByIdAndUpdate(
        id,
        { status: 'archived' },
        { new: true }
      )

      if (!updatedImage) {
        return NextResponse.json(
          { error: 'Image not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ success: true, image: updatedImage })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in PATCH /api/images/[id]:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
