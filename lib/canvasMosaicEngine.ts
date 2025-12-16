/**
 * Canvas Mosaic Engine
 * 
 * Logic for generating the JIO mosaic using HTML5 Canvas.
 * strictly isolated from AI Mosaic Engine.
 */

export const ENGINE_NAME = 'CANVAS';

interface GenerateCanvasMosaicParams {
  imageUrls: string[];
  width: number;
  height: number;
}

export interface CanvasMosaicController {
  canvas: HTMLCanvasElement;
  destroy: () => void;
}

/**
 * Generates a JIO logo mosaic on an HTML Canvas.
 * 
 * @param params Configuration parameters
 * @returns Controller with canvas and destroy method
 */
export function generateCanvasMosaic({
  imageUrls,
  width,
  height
}: GenerateCanvasMosaicParams): CanvasMosaicController {
  // Lifecycle tracking
  let isDestroyed = false;
  let activeRafId: number | null = null;
  let activeTimeoutId: NodeJS.Timeout | null = null;

  const destroy = () => {
    isDestroyed = true;
    if (activeRafId) {
        cancelAnimationFrame(activeRafId);
        activeRafId = null;
    }
    if (activeTimeoutId) {
        clearTimeout(activeTimeoutId);
        activeTimeoutId = null;
    }
  };

  // 1. Create Main Canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx || imageUrls.length === 0) {
    return { canvas, destroy };
  }

  // 2. Define Typography Config
  const fontSize = Math.min(width, height) * 0.8;
  const font = `900 ${fontSize}px sans-serif`;
  const text = 'J\u0131O';
  const textX = width / 2;
  const textY = height / 2;

  // 3. Background Gradient
  const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width);
  gradient.addColorStop(0, '#1c1c1e'); // Charcoal
  gradient.addColorStop(1, '#000000'); // Black

  // Draw Initial Background
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 4. Create Mask Canvas (Offscreen)
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d');
  
  if (!maskCtx) {
    return { canvas, destroy };
  }

  // 5. Draw Typography Mask
  maskCtx.fillStyle = 'black';
  maskCtx.fillRect(0, 0, width, height);
  
  maskCtx.fillStyle = 'white';
  maskCtx.font = font;
  maskCtx.textAlign = 'center';
  maskCtx.textBaseline = 'middle';
  maskCtx.fillText(text, textX, textY);

  // 6. Identify Grid Slots (Body only)
  const GRID_SIZE = 12; 
  const cols = Math.ceil(width / GRID_SIZE);
  const rows = Math.ceil(height / GRID_SIZE);
  
  const imageData = maskCtx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  
  const slots: {x: number, y: number}[] = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * GRID_SIZE + GRID_SIZE / 2;
      const py = y * GRID_SIZE + GRID_SIZE / 2;
      
      if (px >= width || py >= height) continue;

      // Check mask pixel
      const index = (Math.floor(py) * width + Math.floor(px)) * 4;
      if (pixels[index] > 128) { 
        slots.push({ x: x * GRID_SIZE, y: y * GRID_SIZE });
      }
    }
  }

  // 7. Calculate Dot Position Explicitly
  const widthTotal = maskCtx.measureText(text).width;
  const startX = (width / 2) - (widthTotal / 2); 
  const jMetrics = maskCtx.measureText('J');
  const widthI = maskCtx.measureText('\u0131').width;
  
  const iX = startX + jMetrics.width; 
  const dotX = iX + (widthI / 2);
  const dotY = (height / 2) - (0.35 * fontSize);
  const dotSize = widthI * 0.9; 

  // 8. Async Image Loading and Drawing
  const dotUrl = imageUrls[0];
  const bodyUrls = imageUrls.length > 1 ? imageUrls.slice(1) : imageUrls;

  const loadImg = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject();
    img.src = src;
  });

  const render = async () => {
    if (isDestroyed) return;

    // Load images
    let dotImg: HTMLImageElement | null = null;
    try {
      if (dotUrl) dotImg = await loadImg(dotUrl);
    } catch (e) { /* ignore */ }

    if (isDestroyed) return;

    const uniqueBodyUrls = Array.from(new Set(bodyUrls));
    const loadedBodyImages: HTMLImageElement[] = [];
    
    await Promise.all(uniqueBodyUrls.map(async (url) => {
      try {
        if (!isDestroyed) {
          loadedBodyImages.push(await loadImg(url));
        }
      } catch (e) { /* ignore */ }
    }));

    if (isDestroyed || (loadedBodyImages.length === 0 && !dotImg)) return;

    // Easing Functions
    const easeInOutCubic = (t: number) => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    // Animation Config
    const INTRO_DURATION = 800; // ms
    const FILL_DURATION = 2800; // ms
    let startTime: number | null = null;
    let drawnCount = 0;
    
    // Helper to clear background
    const clearBackground = () => {
       ctx.fillStyle = gradient;
       ctx.fillRect(0, 0, width, height);
    };

    const drawDot = () => {
      if (dotImg) {
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(dotImg, dotX - dotSize/2, dotY - dotSize/2, dotSize, dotSize);
        ctx.restore();
      }
    };

    // SPOTLIGHT ANIMATION LOGIC
    const scheduleNextSpotlight = () => {
        if (isDestroyed) return;

        const delay = 4000 + Math.random() * 2000; // 4-6s
        activeTimeoutId = setTimeout(triggerSpotlight, delay);
    };

    const triggerSpotlight = () => {
        if (isDestroyed || slots.length === 0 || loadedBodyImages.length === 0) return;

        // Pick random slot
        const slotIdx = Math.floor(Math.random() * slots.length);
        const slot = slots[slotIdx];
        
        // Determine image logic
        const imgIdx = (slot.x * 31 + slot.y * 17) % loadedBodyImages.length;
        const sourceImg = loadedBodyImages[Math.abs(imgIdx)];
        
        const DURATION = 900;
        let startSpotlight: number | null = null;

        const animateTile = (timestamp: number) => {
             if (isDestroyed) return;

             if (!startSpotlight) startSpotlight = timestamp;
             const elapsed = timestamp - startSpotlight;
             
             // Normalize 0 -> 1 -> 0
             // Triangle wave over duration
             const progress = Math.min(elapsed / DURATION, 1);
             const intensity = 1 - Math.abs(progress * 2 - 1); // 0 -> 1 -> 0
             
             // Redraw original tile (clean slate)
             ctx.save();
             ctx.shadowBlur = 4;
             ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
             ctx.drawImage(sourceImg, slot.x, slot.y, GRID_SIZE, GRID_SIZE);

             // Draw Highlight Overlay
             const maxOpacity = 0.4;
             ctx.fillStyle = `rgba(255, 255, 255, ${intensity * maxOpacity})`;
             ctx.fillRect(slot.x, slot.y, GRID_SIZE, GRID_SIZE);
             
             // Optional: Subtle border
             ctx.strokeStyle = `rgba(255, 255, 255, ${intensity * 0.6})`;
             ctx.lineWidth = 1;
             ctx.strokeRect(slot.x, slot.y, GRID_SIZE, GRID_SIZE);

             ctx.restore();

             if (progress < 1) {
                 activeRafId = requestAnimationFrame(animateTile);
             } else {
                 // Final cleanup: Redraw pure tile one last time
                 ctx.drawImage(sourceImg, slot.x, slot.y, GRID_SIZE, GRID_SIZE);
                 // Schedule next
                 scheduleNextSpotlight();
             }
        };

        activeRafId = requestAnimationFrame(animateTile);
    };


    const frame = (timestamp: number) => {
        if (isDestroyed) return;

        if (!startTime) startTime = timestamp;
        const totalElapsed = timestamp - startTime;

        // PHASE 1: INTRO SEQUENCE
        if (totalElapsed < INTRO_DURATION) {
            clearBackground();
            
            const introProgress = totalElapsed / INTRO_DURATION;
            const scale = 0.95 + (0.1 * introProgress);
            
            let opacity = 0;
            if (introProgress < 0.3) {
                opacity = introProgress / 0.3;
            } else if (introProgress > 0.7) {
                opacity = 1 - ((introProgress - 0.7) / 0.3);
            } else {
                opacity = 1;
            }

            ctx.save();
            ctx.translate(width/2, height/2);
            ctx.scale(scale, scale);
            ctx.translate(-width/2, -height/2);
            
            ctx.fillStyle = `rgba(229, 231, 235, ${opacity})`; 
            ctx.font = font;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, width/2, height/2);
            ctx.restore();

            activeRafId = requestAnimationFrame(frame);
            return;
        }

        // PHASE 2: MOSAIC FILL
        const mosaicElapsed = totalElapsed - INTRO_DURATION;
        const progress = Math.min(mosaicElapsed / FILL_DURATION, 1);
        const eased = easeInOutCubic(progress);

        if (drawnCount === 0 && mosaicElapsed < 50) { 
             clearBackground();
        }

        const targetCount = Math.floor(eased * slots.length);
        
        if (targetCount > drawnCount) {
             ctx.save();
             ctx.shadowBlur = 4;
             ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
             for (let i = drawnCount; i < targetCount; i++) {
                  const slot = slots[i];
                  const idx = (slot.x * 31 + slot.y * 17) % loadedBodyImages.length;
                  const sourceImg = loadedBodyImages[Math.abs(idx)];
                  ctx.drawImage(sourceImg, slot.x, slot.y, GRID_SIZE, GRID_SIZE);
             }
             ctx.restore();
             drawnCount = targetCount;
        }

        if (progress < 1) {
            activeRafId = requestAnimationFrame(frame);
        } else {
            // Cleanup final tiles
            if (drawnCount < slots.length) {
                ctx.save();
                ctx.shadowBlur = 4;
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                for (let i = drawnCount; i < slots.length; i++) {
                     const slot = slots[i];
                     const idx = (slot.x * 31 + slot.y * 17) % loadedBodyImages.length;
                     const sourceImg = loadedBodyImages[Math.abs(idx)];
                     ctx.drawImage(sourceImg, slot.x, slot.y, GRID_SIZE, GRID_SIZE);
                }
                ctx.restore();
            }
            drawDot();
            
            // PHASE 3: IDLE ANIMATION START
            scheduleNextSpotlight();
        }
    };

    activeRafId = requestAnimationFrame(frame);
  };

  render();
  return { canvas, destroy };
}
