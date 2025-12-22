'use client'

import Controls from '@/components/controlPanel/Controls'
import Login from '@/components/controlPanel/Login'
import React, { useEffect, useState } from 'react'
import axios from 'axios'

const ControlPanel = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await axios.get('/api/auth/me')
        setIsAuthenticated(true)
      } catch (error) {
        setIsAuthenticated(false)
      }
    }
    checkAuth()
  }, [])

  if (isAuthenticated === null) {
    // Loading State (Terminal Style)
    return (
        <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-mono">
           <span className="animate-pulse">{'>'} ESTABLISHING_UPLINK...</span>
        </div>
    )
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />
  }

  const handleLogout = async () => {
    try {
        await axios.post('/api/auth/logout')
        setIsAuthenticated(false)
    } catch (error) {
        console.error('Logout failed:', error)
    }
  }

  return (
    <div>
      <Controls onLogout={handleLogout} />
    </div>
  )
}

export default ControlPanel
