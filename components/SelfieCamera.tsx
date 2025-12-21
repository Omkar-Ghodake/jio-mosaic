'use client'

import { useRef, useState, useEffect } from 'react'
import { MdOutlineCameraswitch } from 'react-icons/md'
import { FiX } from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'

interface SelfieCameraProps {
  onCapture: (file: File) => void
  onCancel: () => void
}

export default function SelfieCamera({
  onCapture,
  onCancel,
}: SelfieCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string>('')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')

  // Helper to strictly stop all tracks
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }
    
    setStream(null)
  }

  // Start Camera
  useEffect(() => {
    let mounted = true
    
    const startCamera = async () => {
      // Stop any existing tracks first
      stopCamera()

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })

        if (!mounted) {
            mediaStream.getTracks().forEach(t => t.stop())
            return
        }

        setStream(mediaStream)

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      } catch (err) {
        if (mounted) {
            console.error('Camera error:', err)
            setError('Could not access camera. Please allow permissions.')
        }
      }
    }

    startCamera()

    return () => {
      mounted = false
      stopCamera()
    }
  }, [facingMode])

  const toggleCamera = () => {
    // Implicitly triggers useEffect -> cleanup (stopCamera) -> startCamera
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
  }

  // Handle Capture
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw video frame to canvas
    // Flip horizontally ONLY if using front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert to File
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' })
          
          // STRICT LIFECYCLE: Stop stream BEFORE passing file to parent
          stopCamera()
          
          onCapture(file)
        }
      },
      'image/jpeg',
      0.9
    )
  }

  const handleCancel = () => {
      // STRICT LIFECYCLE: Stop stream BEFORE notifying parent
      stopCamera()
      onCancel()
  }

  return (
    <div className='fixed inset-0 bg-[#050505] z-50 flex flex-col items-center justify-center pt-0'>
      {/* Hidden Canvas for capture */}
      <canvas ref={canvasRef} className='hidden' />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className='w-full h-full max-w-md bg-black overflow-hidden relative shadow-2xl'
      >
        {error ? (
          <div className='h-full flex flex-col items-center justify-center p-8 text-center text-red-400 bg-neutral-900'>
            <p className='mb-6 font-semibold'>{error}</p>
            <button 
                onClick={handleCancel} 
                className='px-6 py-2 rounded-full bg-neutral-800 text-white hover:bg-neutral-700 transition-colors'
            >
              Close Camera
            </button>
          </div>
        ) : (
          <>
            <div className='relative h-full w-full'>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  facingMode === 'user' ? 'transform -scale-x-100' : ''
                }`}
              />
              
              {/* Gradient Overlays */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/80" />
            
            {/* Controls */}
            <div className='absolute bottom-0 left-0 w-full px-8 pb-10 pt-20 flex items-center justify-between z-20'>
              
              <button
                onClick={handleCancel}
                className='w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95'
                aria-label="Cancel"
              >
                 <FiX size={24} />
              </button>

              <div className="relative group">
                  {/* Outer Glow Ring */}
                  <div className="absolute -inset-4 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-full blur-md opacity-40 group-hover:opacity-60 transition-opacity duration-500 animate-pulse" />
                  
                  <button
                    onClick={handleCapture}
                    className='relative w-20 h-20 rounded-full border-[6px] border-white touch-manipulation transform active:scale-90 transition-transform duration-200 bg-white/20 backdrop-blur-sm'
                    aria-label='Take Photo'
                  >
                    <div className="absolute inset-2 rounded-full bg-white w-[calc(100%-16px)] h-[calc(100%-16px)] top-2 left-2" />
                  </button>
              </div>

              <button
                onClick={toggleCamera}
                className='w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95'
                type='button'
                aria-label='Switch Camera'
              >
                <motion.div
                    key={facingMode}
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 180 }}
                    transition={{ duration: 0.4 }}
                >
                    <MdOutlineCameraswitch className="text-2xl" />
                </motion.div>
              </button>
            </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
