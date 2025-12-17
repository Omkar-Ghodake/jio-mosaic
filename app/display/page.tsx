'use client'

import { useState, useEffect, useRef } from 'react'
import MosaicCanvas from '@/components/MosaicCanvas'
import { generateCanvasMosaic } from '@/lib/canvasMosaicEngine'
// WS Client removed - System relies on Polling

type SettingsMode = 'UPLOAD' | 'WAITING' | 'MOSAIC'
type MosaicEngine = 'AI' | 'CANVAS'

interface Image {
  _id: string
  url: string
}

export default function DisplayPage() {
  const [mode, setMode] = useState<SettingsMode>('UPLOAD')
  const [engine, setEngine] = useState<MosaicEngine>('AI')
  const [images, setImages] = useState<Image[]>([])

  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const canvasControllerRef = useRef<{ destroy: () => void } | null>(null)
  const [isCanvasReady, setIsCanvasReady] = useState(false)
  const [isMosaicRunning, setIsMosaicRunning] = useState(false)

  // WebSocket Connection REMOVED
  // System relies purely on Polling below

  // Poilling Settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          setMode(data.mode)
          if (data.engine) setEngine(data.engine)
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
      }
    }

    fetchSettings() // Initial fetch
    const interval = setInterval(fetchSettings, 3000)
    return () => clearInterval(interval)
  }, [])

  // Polling Images
  useEffect(() => {
    // We poll images even in MOSAIC mode just in case, but usually unnecessary once started.
    // Optimization: Stop polling if running?
    // Requirement said "Limit displayed images ... without scrolling".
    if (mode === 'MOSAIC') return

    const fetchImages = async () => {
      try {
        const res = await fetch('/api/images')
        if (res.ok) {
          const data = await res.json()
          const filteredData = data.filter((img) => !img.isPresident)

          console.log('filteredData:', filteredData)

          setImages(filteredData)
        }
      } catch (error) {
        console.error('Error fetching images:', error)
      }
    }

    fetchImages() // Initial fetch
    const interval = setInterval(fetchImages, 3000)
    return () => clearInterval(interval)
  }, [mode])

  // Generate Mosaic Logic
  useEffect(() => {
    // Always cleanup previous canvas controller when dependencies change
    if (canvasControllerRef.current) {
      canvasControllerRef.current.destroy()
      canvasControllerRef.current = null
    }

    // STRICT RENDER CONDITION:
    // Only run if mode is MOSAIC AND we have images.
    if (mode === 'MOSAIC' && images.length > 0) {
      if (!isMosaicRunning) setIsMosaicRunning(true)

      if (engine === 'AI') {
        // AI Engine (MosaicCanvas) now handles placement internally
        // We just verify we have images
        setIsCanvasReady(true)
      } else if (engine === 'CANVAS') {
        if (canvasContainerRef.current) {
          const container = canvasContainerRef.current
          container.innerHTML = '' // HTML Cleanup

          const controller = generateCanvasMosaic({
            imageUrls: images.map((i) => i.url),
            width: 1920,
            height: 1080,
          })

          canvasControllerRef.current = controller
          const canvas = controller.canvas

          // Basic Responsive styles
          canvas.style.width = '100%'
          canvas.style.height = '100%'
          canvas.style.objectFit = 'contain'

          container.appendChild(canvas)
          setIsCanvasReady(true)
        }
      }
    } else {
      // Fallback or Reset state
      setIsCanvasReady(false)
      setIsMosaicRunning(false)
    }

    // Unmount cleanup
    return () => {
      if (canvasControllerRef.current) {
        canvasControllerRef.current.destroy()
        canvasControllerRef.current = null
      }
    }
  }, [mode, images, engine, isMosaicRunning])

  const enterFullScreen = () => {
    const elem = document.documentElement
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch((err) => console.log(err))
    } else if ((elem as any).webkitRequestFullscreen) {
      // Safari
      ;(elem as any).webkitRequestFullscreen()
    } else if ((elem as any).msRequestFullscreen) {
      // IE11
      ;(elem as any).msRequestFullscreen()
    }
  }

  const handleGenerateMosaic = async (selectedEngine: MosaicEngine) => {
    enterFullScreen() // Trigger immediately on user click

    try {
      // Optimistic update for Engine setting only
      setEngine(selectedEngine)
      // Ensure we don't prematurely show "Generating..."
      setIsMosaicRunning(false)

      const payload: any = { engine: selectedEngine }

      // CRITICAL LOGIC FIX:
      // "Engine selection must NOT auto-force mode = 'MOSAIC'"
      // We ONLY set mode to MOSAIC if we actually have images to generate with.
      // This prevents the "switch engine -> become MOSAIC -> block uploads (403)" deadlock.
      if (images.length > 0) {
        payload.mode = 'MOSAIC'
        // Optimistic Mode Update
        setMode('MOSAIC')
      } else {
        // If no images, we stay in UPLOAD mode so user can add them.
        // We DO NOT set 'MOSAIC' mode.
        // Mode remains 'UPLOAD' (or whatever it was).
      }

      await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      console.error('Error setting mode:', error)
    }
  }

  // UI STATE LOGIC
  // "Generating Mosaic..." should ONLY show when: mode === 'MOSAIC' AND required input images are present
  // If we have images, showMosaic becomes true (via effect setting isMosaicRunning).
  // If we don't have images, showMosaic is false.
  const showMosaic = mode === 'MOSAIC' && isMosaicRunning && images.length > 0

  return (
    <main className='min-h-screen bg-black text-white p-4 relative flex items-center justify-center'>
      {showMosaic ? (
        engine === 'CANVAS' ? (
          <div className='w-full h-full flex items-center justify-center relative'>
            <div
              ref={canvasContainerRef}
              className='w-full h-full flex items-center justify-center'
            />
            {!isCanvasReady && (
              <div className='absolute inset-0 flex items-center justify-center'>
                <h1 className='text-4xl font-bold tracking-widest animate-pulse'>
                  Generating Mosaic...
                </h1>
              </div>
            )}
          </div>
        ) : (
          <MosaicCanvas imageUrls={images.map((img) => img.url)} />
        )
      ) : (
        <div className='grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2 w-full h-full align-top content-start'>
          {images.map((img) => (
            <div
              key={img._id}
              className='aspect-square relative overflow-hidden bg-neutral-900 rounded-sm'
            >
              <img
                src={img.url}
                alt='User upload'
                className='w-full h-full object-cover'
                loading='lazy'
              />
            </div>
          ))}
          {images.length === 0 && (
            <div className='col-span-full h-96 flex items-center justify-center text-neutral-500'>
              Waiting for uploads...
            </div>
          )}
        </div>
      )}

      {/* Admin Buttons - Only visible when NOT fully running mosaic */}
      {!showMosaic && (
        <>
          <div className='fixed bottom-6 right-6 flex flex-col gap-3 z-50'>
            <div className='bg-neutral-900/80 backdrop-blur-md p-2 rounded-xl border border-white/10 flex flex-col gap-2 shadow-2xl'>
              <div className='text-xs text-neutral-400 font-bold px-2 uppercase tracking-wider text-center'>
                Select Engine
              </div>
              <div className='flex gap-2'>
                <button
                  onClick={() => handleGenerateMosaic('AI')}
                  className={`px-6 py-3 rounded-lg font-bold text-sm tracking-wide transition-all duration-300 transform hover:scale-105
                      ${
                        engine === 'AI'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/30 shadow-lg border border-transparent'
                          : 'bg-white/5 text-neutral-400 border border-white/10 hover:bg-white/10 hover:text-white'
                      }`}
                >
                  AI Mosaic
                </button>

                <button
                  onClick={() => handleGenerateMosaic('CANVAS')}
                  className={`px-6 py-3 rounded-lg font-bold text-sm tracking-wide transition-all duration-300 transform hover:scale-105
                      ${
                        engine === 'CANVAS'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-purple-500/30 shadow-lg border border-transparent'
                          : 'bg-white/5 text-neutral-400 border border-white/10 hover:bg-white/10 hover:text-white'
                      }`}
                >
                  Canvas Mosaic
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/reset', { method: 'POST' })
                if (res.ok) {
                  setImages([])
                  setMode('UPLOAD')
                  setIsMosaicRunning(false)
                }
              } catch (e) {
                console.error(e)
              }
            }}
            className='fixed bottom-6 left-6 text-neutral-500 hover:text-white font-bold py-3 px-6 z-50 text-sm tracking-wide uppercase'
          >
            Reset System
          </button>
        </>
      )}

      {showMosaic && (
        <div className='fixed top-6 right-6 z-50'>
          <div className='bg-black/50 backdrop-blur px-4 py-2 rounded-full border border-white/10 flex items-center gap-2'>
            <div
              className={`w-2 h-2 rounded-full animate-pulse ${
                engine === 'AI' ? 'bg-blue-500' : 'bg-pink-500'
              }`}
            ></div>
            <span className='text-xs font-bold text-white tracking-widest'>
              {engine} ENGINE ACTIVE
            </span>
          </div>
        </div>
      )}

      {showMosaic && (
        <button
          onClick={async () => {
            try {
              const res = await fetch('/api/reset', { method: 'POST' })
              if (res.ok) {
                setImages([])
                setMode('UPLOAD')
                setIsMosaicRunning(false)
              }
            } catch (e) {
              console.error(e)
            }
          }}
          className='fixed bottom-6 left-6 text-neutral-500 hover:text-white font-bold py-3 px-6 z-50 text-sm tracking-wide uppercase'
        >
          Reset System
        </button>
      )}
    </main>
  )
}
