'use client'

import React, { useEffect, useState } from 'react'
import axios from 'axios'
import Image from 'next/image'

interface ImageData {
  _id: string
  url: string
  isPresident: boolean
}

const Controls = ({ onLogout }: { onLogout: () => void }) => {
  const [totalImages, setTotalImages] = useState<number>(0)
  const [presidentImages, setPresidentImages] = useState<ImageData[]>([])
  const [showPresidentModal, setShowPresidentModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/images')
      if (Array.isArray(res.data)) {
        const images: ImageData[] = res.data
        setTotalImages(images.length)
        setPresidentImages(images.filter((img) => img.isPresident))
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 3000)
    return () => clearInterval(interval)
  }, [])

  // Alerts & Modals State
  const [modalConfig, setModalConfig] = useState<{
    show: boolean
    type: 'ALERT' | 'CONFIRM'
    title: string
    message: string
    color: 'green' | 'red'
    onConfirm: () => void
  }>({ show: false, type: 'ALERT', title: '', message: '', color: 'green', onConfirm: () => {} })

  const showAlert = (title: string, message: string, color: 'green' | 'red' = 'green') => {
    setModalConfig({ show: true, type: 'ALERT', title, message, color, onConfirm: () => setModalConfig(prev => ({ ...prev, show: false })) })
  }

  const showConfirm = (title: string, message: string, color: 'green' | 'red' = 'green', onConfirm: () => void) => {
    setModalConfig({
        show: true, 
        type: 'CONFIRM', 
        title, 
        message, 
        color, 
        onConfirm: () => {
            onConfirm()
            setModalConfig(prev => ({ ...prev, show: false }))
        }
    })
  }

  const handleCreateMosaic = async () => {
    showConfirm(
        'INITIATE_MOSAIC_SEQUENCE?',
        'Are you sure you want to START the Mosaic generation process?',
        'green',
        async () => {
            try {
                setLoading(true)
                await axios.post('/api/settings', { mode: 'MOSAIC' })
                showAlert('SEQUENCE_INITIATED', 'Mosaic generation started successfully.')
            } catch (error) {
                console.error('Error starting mosaic:', error)
                showAlert('SEQUENCE_FAILURE', 'Failed to start mosaic process.', 'red')
            } finally {
                setLoading(false)
            }
        }
    )
  }

  const handleSoftReset = async () => {
    showConfirm(
        'SOFT_RESET_SYSTEM?',
        'This will ARCHIVE current data and RESET the system state. No images will be deleted. Safe for live operations.',
        'green',
        async () => {
            try {
                setLoading(true)
                await axios.post('/api/reset', { mode: 'SOFT' })
                setTotalImages(0)
                setPresidentImages([])
                showAlert('SYSTEM_RESET_SUCCESSFUL', 'System is ready for new uploads. Previous data archived.', 'green')
            } catch (error) {
                console.error('Error resetting system:', error)
                showAlert('RESET_FAILURE', 'Soft reset could not be completed.', 'red')
            } finally {
                setLoading(false)
            }
        }
    )
  }

  const handleHardReset = async () => {
    showConfirm(
        'DANGER: HARD_RESET_DETECTED',
        'WARNING: This will PERMANENTLY DELETE ALL IMAGES from the database and cloud storage. This action is DESTRUCTIVE and CANNOT BE UNDONE.',
        'red',
        async () => {
            try {
                setLoading(true)
                await axios.post('/api/reset', { mode: 'HARD' })
                setTotalImages(0)
                setPresidentImages([])
                showAlert('HARD_RESET_COMPLETE', 'All system data has been permanently destroyed.', 'red')
            } catch (error) {
                console.error('Error resetting system:', error)
                showAlert('RESET_FAILURE', 'Hard reset failed. Data may be partially intact.', 'red')
            } finally {
                setLoading(false)
            }
        }
    )
  }

  const hasPresident = presidentImages.length > 0
  
  return (
    <div className='min-h-screen bg-black text-green-500 p-4 font-mono selection:bg-green-500 selection:text-black flex items-center justify-center'>
      <div className="w-full max-w-lg flex flex-col gap-6">

      {/* ─── HEADER ─── */}
      {/* ─── HEADER ─── */}
      <div className='flex flex-col md:flex-row items-center justify-between gap-4 py-6 border-b-2 border-green-800 border-dashed shrink-0'>
        <h1 className='text-xl md:text-2xl font-bold tracking-tighter animate-pulse text-center md:text-left'>
          {'>'} SYSTEM_CONTROL_PANEL_V2.0 <span className='animate-ping inline-block w-2 h-2 rounded-full bg-green-500 ml-2' />
        </h1>
        <button 
            onClick={onLogout}
            className='px-4 py-2 border border-red-900 text-red-600 hover:bg-red-900/20 hover:text-red-500 text-xs font-bold tracking-widest uppercase transition-all whitespace-nowrap'
        >
            [ LOGOUT ]
        </button>
      </div>

      {/* ─── MONITORING SECTION ─── */}
      <div className='border-2 border-green-800 p-4 flex flex-col gap-4 relative mt-6 shrink-0'>
        <h2 className='absolute -top-3 left-4 bg-black px-2 text-xs font-bold text-green-400 uppercase tracking-widest'>
          [ LIVE_MONITORING ]
        </h2>

        <div className='grid grid-cols-2 gap-4 mt-2'>
          <div className='bg-green-900/10 p-4 border border-green-700 flex flex-col items-center justify-center'>
            <span className='text-4xl font-bold text-green-400 font-mono'>{totalImages}</span>
            <span className='text-xs text-green-600 mt-1 uppercase tracking-widest'>TOTAL_UPLOADS</span>
          </div>

          <div className={`p-4 border flex flex-col items-center justify-center ${hasPresident ? 'bg-green-900/20 border-green-500' : 'bg-red-900/10 border-red-900 text-red-500'}`}>
             <span className={`text-2xl font-bold`}>
                {hasPresident ? 'DETECTED' : 'MISSING'}
             </span>
             <span className={`text-[10px] mt-1 uppercase tracking-widest ${hasPresident ? 'text-green-600' : 'text-red-700'}`}>VIP_STATUS</span>
          </div>
        </div>
        
        {hasPresident && (
            <button 
                onClick={() => setShowPresidentModal(true)}
                className="w-full py-2 border border-green-500/50 hover:bg-green-500/10 hover:border-green-400 text-green-400 text-xs font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 group"
            >
                <span className="group-hover:animate-pulse">[*]</span> VIEW_PRESIDENT_DATA ({presidentImages.length})
            </button>
        )}
      </div>

      {/* ─── ACTION SECTION (Reduced Layout Gap) ─── */}
      <div className='flex flex-col gap-4 mt-6'>
        <div className="border-t border-green-900/50 mb-2" />

        <button
          onClick={handleCreateMosaic}
          disabled={loading || totalImages === 0}
          className='w-full py-6 bg-green-900/20 border-2 border-green-600 text-green-400 hover:bg-green-500 hover:text-black disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-green-400 disabled:cursor-not-allowed text-xl font-bold tracking-wider font-mono transition-all active:scale-[0.98] uppercase flex items-center justify-center gap-4'
        >
          {loading ? 'EXECUTING...' : '[ INITIATE_MOSAIC_SEQUENCE ]'}
        </button>

        <div className="flex gap-4 w-full">
            <button
            onClick={handleSoftReset}
            disabled={loading}
            className='flex-1 py-4 border border-green-900 text-green-600 hover:bg-green-900/20 hover:border-green-600 hover:text-green-500 text-xs font-bold tracking-widest transition-all uppercase mt-2 font-mono'
            >
            [ SOFT_RESET ]
            </button>

            <button
            onClick={handleHardReset}
            disabled={loading}
            className='flex-1 py-4 border border-red-900 text-red-600 hover:bg-red-900/20 hover:border-red-600 hover:text-red-500 text-xs font-bold tracking-widest transition-all uppercase mt-2 font-mono'
            >
            [ HARD_RESET_DANGER ]
            </button>
        </div>
      </div>
      </div>

      {/* ─── CUSTOM ALERT/CONFIRM MODAL ─── */}
      {modalConfig.show && (
          <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
              <div className={`w-full max-w-sm border-2 ${modalConfig.color === 'red' ? 'border-red-600 bg-red-900/10' : 'border-green-600 bg-green-900/10'} p-6 relative shadow-[0_0_50px_rgba(0,0,0,0.8)]`}>
                  <h3 className={`text-xl font-bold mb-4 tracking-wider ${modalConfig.color === 'red' ? 'text-red-500' : 'text-green-500'}`}>
                      {'>'} {modalConfig.title}
                  </h3>
                  <p className={`text-sm mb-8 font-mono leading-relaxed ${modalConfig.color === 'red' ? 'text-red-400' : 'text-green-400'}`}>
                      {modalConfig.message}
                  </p>
                  
                  <div className="flex gap-4">
                      {modalConfig.type === 'CONFIRM' && (
                          <button 
                              onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
                              className={`flex-1 py-3 border ${modalConfig.color === 'red' ? 'border-red-900 text-red-700 hover:bg-red-900/20' : 'border-green-900 text-green-700 hover:bg-green-900/20'} font-bold tracking-widest uppercase text-xs`}
                          >
                              CANCEL
                          </button>
                      )}
                      <button 
                          onClick={modalConfig.onConfirm}
                          className={`flex-1 py-3 ${modalConfig.color === 'red' ? 'bg-red-600 text-black hover:bg-red-500' : 'bg-green-600 text-black hover:bg-green-500'} font-bold tracking-widest uppercase text-xs`}
                      >
                          {modalConfig.type === 'CONFIRM' ? 'CONFIRM' : 'ACKNOWLEDGE'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ─── PRESIDENT PREVIEW MODAL ─── */}
      {showPresidentModal && hasPresident && (
        <div className='fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 font-mono'>
            <div className='absolute inset-0 border-4 border-green-900 pointer-events-none' />
            
            <div className='absolute top-6 right-6 z-50'>
                <button 
                    onClick={() => setShowPresidentModal(false)}
                    className='text-green-500 hover:text-green-300 text-xl font-bold p-2'
                >
                    [X] CLOSE
                </button>
            </div>
            
            <h3 className='text-green-500 mb-6 text-sm uppercase tracking-widest border-b border-green-800 pb-2 w-full text-center'>
               {'>'} PREVIEWING_VIP_TARGET_01
            </h3>
            
            <div className='relative w-full max-w-md aspect-square overflow-hidden border-2 border-green-500 shadow-[0_0_20px_rgba(0,255,0,0.2)] bg-green-900/10'>
                 {/* Scanline Effect */}
                 <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 pointer-events-none bg-[length:100%_4px,3px_100%]" />
                <Image 
                    src={presidentImages[0].url} 
                    alt="President" 
                    fill 
                    className="object-cover grayscale hover:grayscale-0 transition-all duration-500"
                />
            </div>
            
            <div className="mt-8 text-center text-green-700 text-xs animate-pulse">
                _AWAITING_FURTHER_INPUT_
            </div>

            <button
                onClick={() => {
                    showConfirm(
                        'ARCHIVE_VIP_ENTRY?',
                        'This will remove the President image from direct display but keep it in the database records.',
                        'red',
                        async () => {
                            try {
                                await axios.patch(`/api/images/${presidentImages[0]._id}`, { action: 'archive' })
                                setPresidentImages([])
                                setShowPresidentModal(false)
                                fetchStats() // Refresh counts
                                showAlert('ARCHIVE_SUCCESSFUL', 'VIP Entry archived successfully.', 'green')
                            } catch (error) {
                                console.error('Archive failed:', error)
                                showAlert('ARCHIVE_FAILURE', 'Failed to archive entry.', 'red')
                            }
                        }
                    )
                }}
                className="mt-6 px-6 py-2 border border-red-900 text-red-600 hover:bg-red-900/20 hover:text-red-500 text-xs font-bold tracking-widest uppercase transition-all"
            >
                [ ARCHIVE_ENTRY ]
            </button>
        </div>
      )}
    </div>
  )
}

export default Controls
