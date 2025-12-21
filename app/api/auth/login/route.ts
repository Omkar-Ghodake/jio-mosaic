import { NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import User from '@/models/User'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { serialize } from 'cookie'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod'

export async function POST(req: Request) {
  await dbConnect()

  try {
    const { username, password } = await req.json()

    // 1. SEEDING CHECK (Auto-create DaOG if missing)
    // This runs on every login attempt to ensure the admin user always exists
    // In production, you might want into a separate init script.
    const adminUser = await User.findOne({ username: 'DaOG' })
    if (!adminUser) {
        console.log('Seeding Admin User...')
        const hashedPassword = await bcrypt.hash('WhoKnows', 10)
        await User.create({
            username: 'DaOG',
            password: hashedPassword
        })
    }

    // 2. Validate User
    const user = await User.findOne({ username })

    if (user && (await bcrypt.compare(password, user.password))) {
      // 3. Create Token
      const token = jwt.sign(
        { userId: user._id, username: user.username },
        JWT_SECRET,
        { expiresIn: '8h' }
      )

      // 4. Set Cookie
      const serialized = serialize('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 8, // 8 hours
        path: '/',
      })

      return new NextResponse(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Set-Cookie': serialized,
          'Content-Type': 'application/json',
        },
      })
    } else {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    )
  }
}
