'use client'

import React, { useEffect, useState } from 'react'
import axios from 'axios'

const Stats = () => {
  const [count, setCount] = useState<number>(0)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get('/api/images')
        if (Array.isArray(res.data)) {
          setCount(res.data.length)
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
      }
    }

    // Initial fetch
    fetchStats()

    const interval = setInterval(fetchStats, 5000)

    return () => clearInterval(interval)
  }, [])

  return <div>Total Images: {count}</div>
}

export default Stats
