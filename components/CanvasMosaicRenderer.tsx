'use client';

import { useEffect, useRef } from 'react';
import { generateCanvasMosaic, CanvasMosaicController } from '@/lib/canvasMosaicEngine';

interface CanvasMosaicRendererProps {
  imageUrls: string[];
}

export default function CanvasMosaicRenderer({ imageUrls }: CanvasMosaicRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || imageUrls.length === 0) return;

    // Use container dimensions
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Generate mosaic controller
    const controller: CanvasMosaicController = generateCanvasMosaic({
      imageUrls,
      width,
      height
    });

    const canvas = controller.canvas;

    // Append to container
    containerRef.current.innerHTML = '';
    canvas.className = 'w-full h-full object-contain'; // Responsive styling
    containerRef.current.appendChild(canvas);

    // Cleanup function
    return () => {
        controller.destroy();
    };

  }, [imageUrls]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full min-h-[50vh] flex items-center justify-center bg-black"
    >
      {/* Canvas will be appended here */}
      {imageUrls.length === 0 && (
          <p className="text-white/50 animate-pulse">Waiting for images...</p>
      )}
    </div>
  );
}
