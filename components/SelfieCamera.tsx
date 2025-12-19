'use client'

import { useRef, useState, useEffect } from 'react'
import { MdOutlineCameraswitch } from 'react-icons/md'

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

  // Start Camera
  useEffect(() => {
    let currentStream: MediaStream | null = null

    const startCamera = async () => {
      // Stop any existing tracks first
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })

        currentStream = mediaStream
        setStream(mediaStream)

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      } catch (err) {
        console.error('Camera error:', err)
        setError('Could not access camera. Please allow permissions.')
      }
    }

    startCamera()

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop())
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode])

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
    console.log('facingMode', facingMode)
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
          onCapture(file)

          // Stop stream immediately after capture
          if (stream) {
            stream.getTracks().forEach((track) => track.stop())
          }
        }
      },
      'image/jpeg',
      0.9
    )
  }

  return (
    <div className='fixed inset-0 bg-black z-50 flex flex-col items-center justify-center pt-0'>
      {/* Hidden Canvas for capture */}
      <canvas ref={canvasRef} className='hidden' />

      <div className='w-full h-full max-w-md bg-neutral-900  overflow-hidden relative'>
        {error ? (
          <div className='p-8 text-center text-red-400'>
            <p className='mb-4'>{error}</p>
            <button onClick={onCancel} className='text-white underline'>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className='relative bg-black h-full'>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover  ${
                  facingMode === 'user' ? 'transform -scale-x-100' : ''
                }`}
              />

              {/* Switch Camera Button */}
            </div>

            <div className='absolute bottom-5 w-full px-6 flex items-center justify-between'>
              <button
                onClick={onCancel}
                className='text-white text-sm font-medium px-4 py-2 rounded hover:bg-white/10'
              >
                Cancel
              </button>

              <button
                onClick={handleCapture}
                className='w-16 h-16 rounded-full bg-white border-4 border-neutral-300 shadow-lg transform active:scale-95 transition-all absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center'
                aria-label='Take Photo'
              />

              <button
                onClick={toggleCamera}
                className='p-3 rounded-full text-white bg-white/20 transition-colors duration-300 group'
                type='button'
                aria-label='Switch Camera'
              >
                <MdOutlineCameraswitch
                  className={`text-3xl group-active:scale-90 transition-all duration-300 ${
                    facingMode === 'user' ? 'transform -scale-x-100' : ''
                  }`}
                />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
