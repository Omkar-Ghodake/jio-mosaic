import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  try {
    jwt.verify(token.value, JWT_SECRET)
    return NextResponse.json({ authenticated: true }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}
