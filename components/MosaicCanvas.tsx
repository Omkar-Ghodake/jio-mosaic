'use client';

import { useEffect, useRef, useState } from 'react';
import { MosaicPlacement } from '@/lib/mosaicEngine';

interface MosaicCanvasProps {
  placements: MosaicPlacement[];
  startedAt?: number;
  batchSize?: number;
  intervalMs?: number;
}

export default function MosaicCanvas({ 
  placements, 
  startedAt, 
  batchSize = 4, 
  intervalMs = 35 
}: MosaicCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || placements.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Determine bounds
    let maxX = 0;
    let maxY = 0;
    placements.forEach((p) => {
      if (p.x + p.size > maxX) maxX = p.x + p.size;
      if (p.y + p.size > maxY) maxY = p.y + p.size;
    });

    const SCALE = 40;
    canvas.width = maxX * SCALE;
    canvas.height = maxY * SCALE;

    // 2. Start Black
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Preload ALL images
    const loadPromises = placements.map((p) => {
      return new Promise<{ img: HTMLImageElement | null; placement: MosaicPlacement }>((resolve) => {
        const img = new Image();
        img.src = p.imageUrl;
        img.onload = () => resolve({ img, placement: p });
        img.onerror = () => {
          resolve({ img: null, placement: p });
        };
      });
    });

    Promise.all(loadPromises).then((loadedItems) => {
      // 4. Prepare Queues (STRICT ORDER)
      const teamItems = loadedItems.filter((item) => item.placement.region !== 'I_DOT');
      const presidentItems = loadedItems.filter((item) => item.placement.region === 'I_DOT');
      const drawQueue = [...teamItems, ...presidentItems];
      
      // 5. Calculate Fast-forward
      let initialIndex = 0;
      if (startedAt) {
        const elapsed = Date.now() - startedAt;
        if (elapsed > 0) {
          const ticks = Math.floor(elapsed / intervalMs);
          initialIndex = ticks * batchSize;
        }
      }
      
      // Clamp index
      if (initialIndex < 0) initialIndex = 0;
      // If we are way past end, just draw everything immediately
      // But we still want to draw the "rest" efficiently. 
      // Actually, if we are mid-way, we should draw 0..initialIndex immediately in one go
      // Then continue interval.
      
      let currentIndex = 0;

      // Helper to draw a batch
      const drawBatch = (items: typeof drawQueue) => {
        items.forEach(({ img, placement }) => {
          if (img) {
            ctx.drawImage(
              img,
              placement.x * SCALE,
              placement.y * SCALE,
              placement.size * SCALE,
              placement.size * SCALE
            );
          } else {
            ctx.fillStyle = '#111';
            ctx.fillRect(
              placement.x * SCALE,
              placement.y * SCALE,
              placement.size * SCALE,
              placement.size * SCALE
            );
          }
        });
      };

      // Draw initial catch-up batch
      if (initialIndex > 0) {
        const catchUpItems = drawQueue.slice(0, initialIndex);
        drawBatch(catchUpItems);
        currentIndex = initialIndex;
      }

      // If finished already, stop
      if (currentIndex >= drawQueue.length) return;

      // 6. Progressive Render Loop for remaining
      if (intervalRef.current) clearInterval(intervalRef.current);

      intervalRef.current = setInterval(() => {
        if (currentIndex >= drawQueue.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return;
        }

        const batch = drawQueue.slice(currentIndex, currentIndex + batchSize);
        currentIndex += batchSize;
        drawBatch(batch);
      }, intervalMs);
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [placements, startedAt, batchSize, intervalMs]);

  return (
    <div className="flex items-center justify-center w-full h-full">
      <canvas
        ref={canvasRef}
        className="max-w-full max-h-screen object-contain"
      />
    </div>
  );
}
