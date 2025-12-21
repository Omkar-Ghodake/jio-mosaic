'use client'

import React, { useState } from 'react'
import axios from 'axios'

interface LoginProps {
  onLoginSuccess: () => void
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Custom Validation
    if (!username.trim()) {
        setError('ERROR: USERNAME_FIELD_EMPTY')
        setLoading(false)
        return
    }
    if (!password.trim()) {
        setError('ERROR: PASSWORD_FIELD_EMPTY')
        setLoading(false)
        return
    }

    try {
      const res = await axios.post('/api/auth/login', { username, password })
      if (res.data.success) {
        onLoginSuccess()
      }
    } catch (err) {
      setError('ACCESS_DENIED: INVALID_CREDENTIALS')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen bg-black text-green-500 font-mono flex items-center justify-center p-4 selection:bg-green-500 selection:text-black'>
      <div className='w-full max-w-sm border-2 border-green-800 p-8 shadow-[0_0_50px_rgba(0,255,0,0.1)] relative'>
         {/* Decorative Corners */}
         <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-green-500" />
         <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-green-500" />
         <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-green-500" />
         <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-green-500" />

        <h1 className='text-xl font-bold tracking-widest text-center mb-8 flex items-center justify-center gap-2'>
          <span className="text-green-500">{'>'}</span> AUTHENTICATION_REQUIRED
        </h1>

        <form onSubmit={handleLogin} className='flex flex-col gap-6' noValidate>
          <div className='flex flex-col gap-2'>
            <label className='text-xs uppercase tracking-widest text-green-700'>
              [ USER_IDENTITY ]
            </label>
            <input
              type='text'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className='bg-green-900/10 border border-green-800 p-3 text-green-400 focus:outline-none focus:border-green-500 focus:bg-green-900/20 transition-all placeholder-green-900'
              placeholder='ENTER_USERNAME'
              autoComplete="off"
            />
          </div>

          <div className='flex flex-col gap-2'>
            <label className='text-xs uppercase tracking-widest text-green-700'>
              [ SECURITY_KEY ]
            </label>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className='bg-green-900/10 border border-green-800 p-3 text-green-400 focus:outline-none focus:border-green-500 focus:bg-green-900/20 transition-all placeholder-green-900'
              placeholder='ENTER_PASSWORD'
            />
          </div>

          {error && (
            <div className='p-3 border border-red-900 bg-red-900/10 text-red-500 text-xs text-center font-bold tracking-widest animate-pulse'>
              {'>'} {error}
            </div>
          )}

          <button
            type='submit'
            disabled={loading}
            className='mt-4 w-full py-4 bg-green-600 text-black font-bold tracking-widest hover:bg-green-500 transition-colors disabled:opacity-50 uppercase flex items-center justify-center gap-2'
          >
            {loading ? (
                <span className="animate-spin text-xl">/</span>
            ) : (
                'INITIATE_SESSION'
            )}
          </button>
        </form>
        
        <div className="mt-8 text-center">
            <span className="text-[10px] text-green-800">SECURE_CONNECTION_ESTABLISHED</span>
        </div>
        <style jsx>{`
          input {
            caret-shape: block;
            caret-color: #22c55e;
          }
        `}</style>
      </div>
    </div>
  )
}

export default Login
