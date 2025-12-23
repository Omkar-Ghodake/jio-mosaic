'use client'

import MosaicCanvas from '@/components/MosaicCanvas'
import { generateCanvasMosaic } from '@/lib/canvasMosaicEngine'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type SettingsMode = 'UPLOAD' | 'WAITING' | 'MOSAIC'
type MosaicEngine = 'AI' | 'CANVAS'

interface UploadImage {
  _id: string
  url: string
  isPresident: boolean
}

interface CanvasController {
  canvas: HTMLCanvasElement
  destroy: () => void
}

interface MotionData {
  top: number
  left: number
  rotate: number
  delay: number
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function DisplayPage() {
  const [mode, setMode] = useState<SettingsMode>('UPLOAD')
  const [engine, setEngine] = useState<MosaicEngine>('AI')
  const [images, setImages] = useState<UploadImage[]>([])

  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const canvasControllerRef = useRef<CanvasController | null>(null)

  const [isCanvasReady, setIsCanvasReady] = useState(false)
  const [isMosaicRunning, setIsMosaicRunning] = useState(false)

  // Stable animation data (state, strict-mode safe)
  const [motionMap, setMotionMap] = useState<Record<string, MotionData>>({})

  // ─────────────────────────────────────────────
  // Poll Settings
  // ─────────────────────────────────────────────

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data: { mode: SettingsMode; engine?: MosaicEngine } =
            await res.json()
          setMode(data.mode)
          if (data.engine) setEngine(data.engine)
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
      }
    }

    fetchSettings()
    const interval = setInterval(fetchSettings, 3000)
    return () => clearInterval(interval)
  }, [])

  // ─────────────────────────────────────────────
  // Poll Images
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (mode === 'MOSAIC') return

    const fetchImages = async () => {
      try {
        const res = await fetch('/api/images')
        if (res.ok) {
          const data: UploadImage[] = await res.json()
          console.log('data:', data)
          setImages(data)
        }
      } catch (error) {
        console.error('Error fetching images:', error)
      }
    }

    fetchImages()
    const interval = setInterval(fetchImages, 3000)
    return () => clearInterval(interval)
  }, [mode])

  // ─────────────────────────────────────────────
  // Generate RANDOM positions ONCE per image
  // ─────────────────────────────────────────────

  useEffect(() => {
    setMotionMap((prev) => {
      const next = { ...prev }

      images.forEach((img) => {
        if (!next[img._id]) {
          next[img._id] = {
            top: Math.random() * 80 + 5,
            left: Math.random() * 80 + 5,
            rotate: Math.random() * 12 - 6,
            delay: Math.random() * 0.25,
          }
        }
      })

      return next
    })
  }, [images])

  // ─────────────────────────────────────────────
  // Mosaic Generation
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (canvasControllerRef.current) {
      canvasControllerRef.current.destroy()
      canvasControllerRef.current = null
    }

    if (mode === 'MOSAIC' && images.length > 0) {
      setIsMosaicRunning(true)

      if (engine === 'AI') {
        setIsCanvasReady(true)
      }

      if (engine === 'CANVAS' && canvasContainerRef.current) {
        const container = canvasContainerRef.current
        container.innerHTML = ''

        const controller = generateCanvasMosaic({
          imageUrls: images.map((i) => i.url),
          width: 1920,
          height: 1080,
        })

        canvasControllerRef.current = controller

        const canvas = controller.canvas
        canvas.style.width = '100%'
        canvas.style.height = '100%'
        canvas.style.objectFit = 'contain'

        container.appendChild(canvas)
        setIsCanvasReady(true)
      }
    } else {
      setIsCanvasReady(false)
      setIsMosaicRunning(false)
    }

    return () => {
      if (canvasControllerRef.current) {
        canvasControllerRef.current.destroy()
        canvasControllerRef.current = null
      }
    }
  }, [mode, images, engine])

  // ─────────────────────────────────────────────
  // Fullscreen
  // ─────────────────────────────────────────────

  const enterFullScreen = () => {
    const elem = document.documentElement
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {})
    }
  }

  // ─────────────────────────────────────────────
  // Engine Switch
  // ─────────────────────────────────────────────

  const handleGenerateMosaic = async (selectedEngine: MosaicEngine) => {
    enterFullScreen()

    try {
      setEngine(selectedEngine)
      setIsMosaicRunning(false)

      const payload: { engine: MosaicEngine; mode?: SettingsMode } = {
        engine: selectedEngine,
      }

      if (images.length > 0) {
        payload.mode = 'MOSAIC'
        setMode('MOSAIC')
      }

      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      console.error('Error setting mode:', error)
    }
  }

  const showMosaic = mode === 'MOSAIC' && isMosaicRunning && images.length > 0

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <main className={`min-h-screen max-h-screen overflow-hidden text-white relative flex items-center justify-center ${showMosaic ? "bg-[#16162a]" : 'bg-[#16162a]'}`}>
      {/* Background Gradients - Lighter & More Vibrant */}
      <div className='absolute top-0 left-0 w-full h-3/4 bg-purple-600/40 blur-[150px] rounded-full pointer-events-none' />
      <div className='absolute bottom-0 right-0 w-3/4 h-3/4 bg-indigo-600/40 blur-[130px] rounded-full pointer-events-none' />

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
          <MosaicCanvas images={images} />
        )
      ) : (
        <div className='relative w-full h-screen'>
          {images.map(
            (img) => motionMap[img._id] && (
                <motion.div
                  key={img._id}
                  className='absolute'
                  style={{
                    top: `${motionMap[img._id].top}%`,
                    left: `${motionMap[img._id].left}%`,
                  }}
                  initial={{
                    opacity: 0,
                    scale: 0,
                    rotate: motionMap[img._id].rotate,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    rotate: 0,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 160,
                    damping: 18,
                    delay: motionMap[img._id].delay,
                  }}
                >
                  <div className='w-20 h-20 md:w-24 md:h-24 rounded-md overflow-hidden bg-neutral-900 shadow-lg'>
                    <img
                      src={img.url}
                      alt='User upload'
                      className='w-full h-full object-cover'
                      loading='lazy'
                    />
                  </div>
                </motion.div>
              )
          )}

          <div className='absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-center space-y-12 z-20'>
             <div className="relative">
                <h1 
                    className='text-7xl md:text-9xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-indigo-300 bg-clip-text text-transparent drop-shadow-[0_5px_15px_rgba(255,255,255,0.3)] py-4 leading-relaxed'
                    style={{ fontFamily: 'var(--font-shadows-into-light)' }}
                >
                    KISNE BANAYA JIO?
                </h1>
             </div>

            <div className="flex flex-col items-center gap-6">
                 {/* QR Card - Static Minimalist - No Hover */}
                <div className="relative bg-white/10 backdrop-blur-2xl rounded-3xl p-0 border border-white/40 shadow-2xl overflow-hidden">
                     <Image
                        src='/public_qr.png'
                        alt='public_qr'
                        width={350}
                        height={350}
                        className='brightness-0 invert opacity-95'
                     />
                </div>
                 <p className="text-xl md:text-2xl font-light tracking-widest text-purple-100/90 drop-shadow-md animate-pulse uppercase">
                     Scan QR to know
                 </p>
            </div>
          </div>
        </div>
      )}

      {!showMosaic && (
        <>
            {/* Buttons Removed as requested */}
        </>
      )}
    </main>
  )
}
