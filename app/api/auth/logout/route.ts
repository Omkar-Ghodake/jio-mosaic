import { NextResponse } from 'next/server'
import { serialize } from 'cookie'

export async function POST() {
  const serialized = serialize('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: -1, // Expire immediately
    path: '/',
  })

  return new NextResponse(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Set-Cookie': serialized,
      'Content-Type': 'application/json',
    },
  })
}
