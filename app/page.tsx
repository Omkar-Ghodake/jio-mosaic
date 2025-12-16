'use client';

import { useState, useEffect, FormEvent } from 'react';
import SelfieCamera from '@/components/SelfieCamera';

type SettingsMode = 'UPLOAD' | 'WAITING' | 'MOSAIC';

export default function Home() {
  const [mode, setMode] = useState<SettingsMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  
  // Camera State
  const [showCamera, setShowCamera] = useState(false);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        setMode(data.mode);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch settings:', err);
        setLoading(false);
      });
  }, []);

  const handleCapture = (file: File) => {
    setCapturedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setShowCamera(false);
  };

  const handleRetake = () => {
    setCapturedFile(null);
    setPreviewUrl(null);
    setShowCamera(true);
  };

  const handleUpload = async () => {
    if (!capturedFile) return;
    
    setUploadStatus('uploading');
    setMessage('');

    const formData = new FormData();
    formData.append('file', capturedFile);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setUploadStatus('success');
        setMessage('Upload successful!');
        setCapturedFile(null);
        setPreviewUrl(null);
      } else {
        setUploadStatus('error');
        setMessage('Upload failed. Please try again.');
        // Don't clear file on error so they can retry
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setMessage('An error occurred during upload.');
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-100">
        <p>Loading...</p>
      </main>
    );
  }

  if (mode !== 'UPLOAD') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-100 p-4">
        <div className="text-center">
          <p className="text-xl">Uploads are closed. Please look at the main screen.</p>
        </div>
      </main>
    );
  }

  // Camera Overlay
  if (showCamera) {
      return (
          <SelfieCamera 
            onCapture={handleCapture} 
            onCancel={() => setShowCamera(false)} 
          />
      );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-neutral-900 text-neutral-100 p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">Jio Mosaic Selfie</h1>
        
        {uploadStatus === 'success' ? (
          <div className="text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <p className="text-green-400 mb-6 font-bold text-lg">{message}</p>
            <button 
              onClick={() => {
                setUploadStatus('idle');
                setMessage('');
                setCapturedFile(null);
                setPreviewUrl(null);
              }}
              className="bg-neutral-800 text-white py-3 px-6 rounded-lg font-bold hover:bg-neutral-700 w-full mb-3"
            >
              Take Another Selfie
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            
            {/* Main Action Area */}
            {!capturedFile ? (
                <div className="text-center">
                     <div className="mb-8">
                         <div className="w-32 h-32 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-neutral-600">
                            <span className="text-4xl">📸</span>
                         </div>
                         <p className="text-neutral-400 text-sm">Tap below to open camera</p>
                     </div>
                     
                     <button
                        onClick={() => setShowCamera(true)}
                        className="bg-blue-600 text-white font-bold py-4 px-6 rounded-xl w-full text-lg shadow-lg hover:bg-blue-500 transition-all transform hover:scale-105"
                     >
                        Open Camera
                     </button>
                </div>
            ) : (
                // Review & Upload Mode
                <div className="flex flex-col gap-4">
                    <div className="aspect-[3/4] w-full bg-black rounded-xl overflow-hidden shadow-lg relative">
                        <img src={previewUrl!} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    
                    <div className="flex gap-2">
                         <button 
                            onClick={handleRetake}
                            className="flex-1 bg-neutral-700 text-white font-bold py-3 rounded-lg hover:bg-neutral-600"
                            disabled={uploadStatus === 'uploading'}
                         >
                            Retake
                         </button>
                         <button 
                            onClick={handleUpload}
                            disabled={uploadStatus === 'uploading'}
                            className="flex-[2] bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                         >
                            {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload Selfie'}
                         </button>
                    </div>
                     {uploadStatus === 'error' && (
                        <p className="text-red-400 text-center text-sm font-bold">{message}</p>
                    )}
                </div>
            )}

            {/* Hidden fallback info? No, explicit instructions to be strict. */}
          </div>
        )}
      </div>
    </main>
  );
}
