'use client';

import { useRef, useState, useEffect } from 'react';

interface SelfieCameraProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

export default function SelfieCamera({ onCapture, onCancel }: SelfieCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');

  // Start Camera on Mount
  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error('Camera error:', err);
        setError('Could not access camera. Please allow permissions.');
      }
    };

    startCamera();

    return () => {
      // Cleanup tracks
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Only run once on mount

  // Handle Capture
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame to canvas
    // Flip horizontally for "mirror" effect if using front camera usually expected
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to File
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
        onCapture(file);
        
        // Stop stream immediately after capture
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
      }
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-4">
      {/* Hidden Canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="w-full max-w-md bg-neutral-900 rounded-xl overflow-hidden shadow-2xl relative">
        {error ? (
          <div className="p-8 text-center text-red-400">
            <p className="mb-4">{error}</p>
            <button onClick={onCancel} className="text-white underline">Cancel</button>
          </div>
        ) : (
          <>
            <div className="relative aspect-[3/4] bg-black">
               <video 
                 ref={videoRef} 
                 autoPlay 
                 playsInline 
                 muted 
                 className="w-full h-full object-cover transform -scale-x-100" // Mirror preview
               />
            </div>
            
            <div className="p-6 flex items-center justify-between bg-neutral-800">
               <button 
                 onClick={onCancel}
                 className="text-white text-sm font-medium px-4 py-2 rounded hover:bg-white/10"
               >
                 Cancel
               </button>
               
               <button 
                 onClick={handleCapture}
                 className="w-16 h-16 rounded-full bg-white border-4 border-neutral-300 shadow-lg transform active:scale-95 transition-all"
                 aria-label="Take Photo"
               />
               
               <div className="w-16" /> {/* Spacer for centering */}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
