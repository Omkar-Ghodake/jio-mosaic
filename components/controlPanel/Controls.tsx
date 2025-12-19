'use client'

import React from 'react'
import axios from 'axios'
import Stats from './Stats'

const Controls = () => {
  const handleCreateMosaic = async () => {
    try {
      await axios.post('/api/settings', { mode: 'MOSAIC' })
    } catch (error) {
      console.error('Error starting mosaic:', error)
    }
  }

  const handleReset = async () => {
    try {
      await axios.post('/api/reset')
    } catch (error) {
      console.error('Error resetting system:', error)
    }
  }

  return (
    <div className='w-screen h-screen overflow-hidden flex flex-col items-center justify-center gap-4 bg-black text-white'>
      <Stats />
      <div className='flex gap-4'>
        <button
          onClick={handleCreateMosaic}
          className='px-4 py-2 bg-blue-600 rounded hover:bg-blue-700'
        >
          Create Mosaic
        </button>
        <button
          onClick={handleReset}
          className='px-4 py-2 bg-red-600 rounded hover:bg-red-700'
        >
          Reset System
        </button>
      </div>
    </div>
  )
}

export default Controls
