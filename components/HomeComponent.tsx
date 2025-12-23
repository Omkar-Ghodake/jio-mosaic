'use client'
import React, { useEffect, useState } from 'react'
import SelfieCamera from './SelfieCamera'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { FiCamera, FiUploadCloud, FiRefreshCw } from 'react-icons/fi'

type SettingsMode = 'UPLOAD' | 'WAITING' | 'MOSAIC'

const HomeComponent = () => {
  const [mode, setMode] = useState<SettingsMode | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'uploading' | 'success' | 'error'
  >('idle')
  const [message, setMessage] = useState('')

  // Camera State
  const [showCamera, setShowCamera] = useState(false)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const isPresident = searchParams.get('isPresident')
  const authId = searchParams.get('authId')

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        setMode(data.mode)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to fetch settings:', err)
        setLoading(false)
      })
  }, [])

  const handleCapture = (file: File) => {
    setCapturedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setShowCamera(false)
  }

  const handleRetake = () => {
    setCapturedFile(null)
    setPreviewUrl(null)
    setShowCamera(true)
  }

  const handleUpload = async () => {
    if (!capturedFile) return

    setUploadStatus('uploading')
    setMessage('')

    const formData = new FormData()
    formData.append('file', capturedFile)
    formData.append('isPresident', String(isPresident))
    formData.append('authId', authId ?? '') // IMPORTANT: avoid "null"

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok) {
        setUploadStatus('success')
        setMessage(data.message || 'Upload successful!')
        setCapturedFile(null)
        setPreviewUrl(null)
      } else {
        setUploadStatus('error')
        setMessage(data.error || 'Upload failed.')
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus('error')
      setMessage('An error occurred during upload.')
    }
  }

  if (loading) {
    return (
      <main className='min-h-screen flex items-center justify-center bg-[#050505] text-neutral-100'>
        <p>Loading...</p>
      </main>
    )
  }

  if (mode !== 'UPLOAD') {
    return (
      <main className='min-h-screen flex items-center justify-center bg-[#050505] text-neutral-100 p-4'>
        <div className='text-center'>
          <p className='text-xl'>
            Uploads are closed. Please look at the main screen.
          </p>
        </div>
      </main>
    )
  }

  // Camera Overlay
  if (showCamera) {
    return (
      <SelfieCamera
        onCapture={handleCapture}
        onCancel={() => setShowCamera(false)}
        allowBackCamera={!!(isPresident && authId)}
      />
    )
  }

  return (
    <main className={`h-screen max-h-screen w-full flex flex-col items-center ${uploadStatus === 'success' ? 'justify-start' : 'justify-center'} bg-[#050505] text-white p-6 md:p-10 relative overflow-hidden`}>
      {/* Background Gradients */}
      <div className='absolute top-0 left-0 w-full h-1/2 bg-purple-900/20 blur-[120px] rounded-full pointer-events-none' />
      <div className='absolute bottom-0 right-0 w-3/4 h-1/2 bg-indigo-900/10 blur-[100px] rounded-full pointer-events-none' />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className='w-full max-w-sm relative z-10'
      >
        <div className={`flex flex-col items-center text-center`}>
            <div className="flex items-center gap-2">
              <motion.div
                initial={{ transform: "scale(0.8)", opacity: 0 }}
                animate={{ transform: "scale(1)", opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mb-6 p-4 rounded-full bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 backdrop-blur-sm border border-white/10"
            >
                 <FiCamera className="w-8 h-8 text-purple-400" />
            </motion.div>

          <h1 className='text-3xl font-extrabold mb-3 bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-sm'>
            Jio Mosaic Selfie
          </h1>
            </div>

          <p className='text-neutral-400 text-sm mb-5 leading-relaxed'>
            Add your smile to the mosaic. Together let's turn this moment into beautiful memories.
          </p>

          {uploadStatus === 'success' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className='text-center w-full bg-neutral-900/50 p-6 rounded-3xl border border-white/10 backdrop-blur-md'
            >
              <div className='w-16 h-16 bg-gradient-to-tr from-green-500 to-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/20'>
                <svg
                  className='w-8 h-8 text-white'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={3}
                    d='M5 13l4 4L19 7'
                  />
                </svg>
              </div>
              <p className='text-white mb-6 font-semibold text-lg'>{message}</p>
              <button
                onClick={() => {
                  setUploadStatus('idle')
                  setMessage('')
                  setCapturedFile(null)
                  setPreviewUrl(null)
                }}
                className='bg-neutral-800 text-white py-4 px-6 rounded-2xl font-semibold hover:bg-neutral-700 w-full transition-all border border-white/5 active:scale-95'
              >
                Take Another Selfie
              </button>
            </motion.div>
          ) : (
            <div className='flex flex-col gap-6 w-full'>
              {/* Main Action Area */}
              {!capturedFile ? (
                <div className='w-full'>
                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: "0 20px 25px -5px rgb(124 58 237 / 0.3)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCamera(true)}
                    className='group relative bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-5 px-8 rounded-full w-full text-lg shadow-xl shadow-purple-500/20 overflow-hidden transition-all'
                  >
                     <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                     <span className="relative flex items-center justify-center gap-2">
                        <FiCamera className="text-xl" />
                        Open Camera
                     </span>
                  </motion.button>
                  
                  <div className='mt-8 flex justify-center gap-2'>
                        {/* Decorative bubbles or pills if needed, kept simple for now */}
                  </div>
                </div>
              ) : (
                // Review & Upload Mode
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className='flex flex-col gap-4'
                >
                  <div className='h-[55vh] w-auto aspect-[3/4] mx-auto bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl relative border border-white/10'>
                    <img
                      src={previewUrl!}
                      alt='Preview'
                      className='w-full h-full object-cover'
                    />
                  </div>

                  <div className='flex gap-3'>
                    <button
                      onClick={handleRetake}
                      className='flex-1 bg-neutral-800/80 backdrop-blur-sm text-white font-semibold py-4 rounded-2xl border border-white/10 hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2'
                      disabled={uploadStatus === 'uploading'}
                    >
                      <FiRefreshCw /> Retake
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={uploadStatus === 'uploading'}
                      className='flex-[2] bg-white text-black font-bold py-4 rounded-2xl hover:bg-neutral-200 disabled:opacity-50 transition-colors shadow-lg shadow-white/5 flex items-center justify-center gap-2'
                    >
                      {uploadStatus === 'uploading' ? (
                          <>Uploading...</>
                      ) : (
                          <> <FiUploadCloud /> Upload Selfie </>
                      )}
                    </button>
                  </div>
                  {uploadStatus === 'error' && (
                    <p className='text-red-400 text-center text-sm font-semibold bg-red-900/20 py-2 rounded-lg border border-red-500/20'>
                      {message}
                    </p>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </main>
  )
}

export default HomeComponent
