'use client'
import React, { useEffect, useRef, useState } from 'react'

export interface MosaicImage {
  url: string
  isPresident: boolean
}

interface MosaicCanvasProps {
  images: MosaicImage[]
}

interface Placement {
  cx: number
  cy: number
  w: number
  h: number
  angle: number
  img: HTMLImageElement // High Quality Source (for Final & Popup)
  thumb: HTMLCanvasElement | HTMLImageElement // Optimized Cache (for Animation)
  blurredThumb?: HTMLCanvasElement | HTMLImageElement // Pre-blocked Cache (for specific animation phase)
  isDot: boolean
  group: 'J' | 'I' | 'O' | 'DOT' // Added group tracking
}

interface TileRect {
  x: number
  y: number
  w: number
  h: number
}

interface ActiveTile {
  img: string
  rect: TileRect
  id: number | string
  target: TileRect
}

// --- Global Audio Singleton (Module Level) ---
// This ensures we capture the VERY FIRST user interaction to unlock audio
// even if this component hasn't mounted yet.
let globalAudio: HTMLAudioElement | null = null
let isAudioUnlocked = false
let pendingPlayCallback: (() => void) | null = null

const initGlobalAudio = () => {
  if (typeof window === 'undefined') return
  if (globalAudio) return

  globalAudio = new Audio('/jio-mosaic-full-audio.mp3')
  globalAudio.preload = 'auto'

  const unlock = () => {
    if (isAudioUnlocked || !globalAudio) return
    
    // Attempt silent play-pause to unlock AudioContext
    globalAudio.play()
      .then(() => {
        globalAudio!.pause()
        globalAudio!.currentTime = 0
        isAudioUnlocked = true
        // If the mosaic has already requested playback, honor it now
        if (pendingPlayCallback) {
          pendingPlayCallback()
          pendingPlayCallback = null
        }
      })
      .catch((err) => {
        console.warn("Audio unlock failed (likely no gesture):", err)
      })

    // Clean up one-time listeners
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }

  // Capture generic interactions
  window.addEventListener('pointerdown', unlock, { once: true, capture: true })
  window.addEventListener('keydown', unlock, { once: true, capture: true })
}

// Eagerly initialize on module load (client-side)
if (typeof window !== 'undefined') {
  initGlobalAudio()
}

export default function MosaicCanvas({ images }: MosaicCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null) 
  const hasInteractedRef = useRef(false)
  // State & Refs
  const placementsRef = useRef<Placement[]>([])
  const [downloadUrl, setDownloadUrl] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [hoveredImage, setHoveredImage] = useState<string | null>(null)
  const [activeTile, setActiveTile] = useState<ActiveTile | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 })

  const containerRef = useRef<HTMLDivElement>(null)

  const lastInteractionRef = useRef(0)
  const popupCountRef = useRef(0)

  const getTileRect = (p: Placement): TileRect | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = rect.width / canvas.width
    const scaleY = rect.height / canvas.height
    const w = p.w * scaleX
    const h = p.h * scaleY
    const x = rect.left + p.cx * scaleX - w / 2
    const y = rect.top + p.cy * scaleY - h / 2
    return { x, y, w, h }
  }

  const getImgSrc = (img: HTMLImageElement | HTMLCanvasElement): string => {
    if (img instanceof HTMLImageElement) return img.src
    return img.toDataURL()
  }

  useEffect(() => {
    if (!images || images.length === 0) return

    setHoveredImage(null)
    placementsRef.current = []
    popupCountRef.current = 0

    const loadImages = async () => {
      setIsGenerating(true)

      const processImage = (data: MosaicImage) => {
        return new Promise<{
          img: HTMLImageElement
          isPresident: boolean
        } | null>((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'Anonymous'
          img.src = data.url
          img.onload = () => resolve({ img, isPresident: data.isPresident })
          img.onerror = () => resolve(null)
        })
      }

      try {
        const results = await Promise.all(images.map(processImage))
        const validImages = results.filter(
          (result): result is { img: HTMLImageElement; isPresident: boolean } =>
            result !== null
        )

        if (validImages.length > 0) {
          generateMosaic(validImages)
        } else {
          setIsGenerating(false)
        }
      } catch (error) {
        console.error('Error loading images', error)
        setIsGenerating(false)
      }
    }

    let isMounted = true
    loadImages().then(() => {
        if (!isMounted) return
    })
    
    return () => {
      isMounted = false
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [images])

  const generateMosaic = (
    loadedData: { img: HTMLImageElement; isPresident: boolean }[]
  ) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const placements: Placement[] = []

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = canvas.getBoundingClientRect()
    const width = Math.floor(rect.width * dpr)
    const height = Math.floor(rect.height * dpr)

    canvas.width = width
    canvas.height = height

    // --- Audio Playback (Singleton) ---
    try {
      // Ensure initialized (just in case)
      initGlobalAudio()
      
      const audio = globalAudio!
      
      // Reset for this run
      audio.pause()
      audio.currentTime = 0
      audioRef.current = audio

      const animStartTime = performance.now()
      
      const runPlayback = () => {
         // Metadata safety check inside the execution wrapper
         const attemptPlay = () => {
             const elapsed = (performance.now() - animStartTime) / 1000
             // Standard sync logic
             if (isNaN(audio.duration) || elapsed < audio.duration) {
                 audio.currentTime = Math.max(0, elapsed)
                 audio.play().catch(e => console.error("Final play blocked:", e))
             }
         }

         if (audio.readyState >= 1) { // HAVE_METADATA
             attemptPlay()
         } else {
             audio.addEventListener('loadedmetadata', attemptPlay, { once: true })
         }
      }

      if (isAudioUnlocked) {
          runPlayback()
      } else {
          // Queue it for whenever the user clicks/taps next (or if the unlock promise resolves)
          pendingPlayCallback = runPlayback
      }

    } catch (err) {
      console.error('Audio setup failed:', err)
    }

    // Clear background
    // Clear background with detailed gradient matching app theme
    // bg-[radial-gradient(ellipse_at_center,_#3E0A86_0%,_#1A0761_40%,_#030055_75%)]
    // Canvas radial gradient is circular. To simulate ellipse, we could scale, but for background circular is often preferred or close enough.
    // Let's ensure it covers well.
    const maxDim = Math.max(width, height)
    // Clear background
    // Removed gradient as per user request to be transparent (showing main page bg)
    ctx.clearRect(0, 0, width, height)

    // --- Dynamic Font Sizing (Maximized) ---
    // Create a temporary canvas to measure text
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    // Initial estimate logic
    let fontSize = height // Start big
    tempCtx.font = `900 ${fontSize}px shadows-into-light, Arial, sans-serif`

    const gapFactor = 0.05 // Tracking

    const measureJio = (size: number) => {
      tempCtx.font = `900 ${size}px Arial, sans-serif`
      const j = tempCtx.measureText('J')
      const i = tempCtx.measureText('\u0131')
      const o = tempCtx.measureText('o')
      const gap = -size * gapFactor
      const totalW = j.width + gap + i.width + gap + o.width
      return { totalW, j, i, o, gap }
    }

    // Binary search or iterative reduction to fit width
    let metrics = measureJio(fontSize)
    // Target: 95% of width or height
    // Target: 95% of width or height
    // Target: 95% of width or height
    // Target: 95% of width or height
    // Target: 95% of width or height
    const targetWidth = width * 0.85
    const targetHeight = height * 0.85 // Reduced to leave room for button at bottom

    // Approx adjustment
    if (metrics.totalW > targetWidth) {
      fontSize = fontSize * (targetWidth / metrics.totalW)
    }

    // Re-measure after initial adjustment
    metrics = measureJio(fontSize)

    // Also check vertical bounds (rough estimate using font size as height)
    if (fontSize > targetHeight) {
      fontSize = targetHeight
      metrics = measureJio(fontSize)
    }

    const font = `900 ${fontSize}px shadows-into-light, Arial, sans-serif`

    // --- 1. Prepare Mask for "Jıo" ---
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = width
    maskCanvas.height = height
    const mCtx = maskCanvas.getContext('2d', { willReadFrequently: true }) // Optimize for getImageData
    if (!mCtx) return

    mCtx.fillStyle = 'white'
    mCtx.font = font
    mCtx.textBaseline = 'middle'

    // Soften edges for "blurred" crop effect
    // 8K resolution requires significant blur radius
    mCtx.shadowColor = 'white'
    mCtx.shadowBlur = width * 0.01 // ~75px blur on 8K
    // mCtx.filter = `blur(${width * 0.005}px)`; // Alternative if shadow isn't enough

    // Recalculate positions based on final metrics
    const { totalW, j, i, o, gap: textGap } = metrics

    const startX = (width - totalW) / 2
    const centerY = height * 0.6 // Shifted up to reduce gap with title

    let cursorX = startX

    // Draw J
    mCtx.fillText('J', cursorX, centerY)
    cursorX += j.width + textGap

    // Draw dotless i
    const iX = cursorX
    mCtx.fillText('\u0131', iX, centerY)
    cursorX += i.width + textGap

    // Draw o
    const oX = cursorX
    mCtx.fillText('o', cursorX, centerY)

    // --- 2. Fill with Smart Random Scatter ---
    const mosaicCanvas = document.createElement('canvas')
    mosaicCanvas.width = width
    mosaicCanvas.height = height
    const moCtx = mosaicCanvas.getContext('2d')
    if (!moCtx) return

    // Configuration
    const targetCount = 5000 // Slightly reduced for better mobile perf
    const maxAttempts = 100000
    const baseSize = fontSize / 14

    // Separate President Images
    // We want the LATEST uploaded president image for the dot.
    // Since API sorts by createdAt asc, the last one in the list is the latest.
    const allPresidentData = loadedData.filter((d) => d.isPresident)
    const presidentData =
      allPresidentData.length > 0
        ? allPresidentData[allPresidentData.length - 1]
        : undefined
    const validCommonData = loadedData.filter((d) => !d.isPresident)

    // If no common images (only president?), use president as common too?
    // Or just fallback to whatever we have if list is empty.
    // Requirement: President ONLY in dot.
    // If we only have 1 image and it's president, we can't fill the mosaic.
    // Assuming sufficient images. If not, we might have to reuse president?
    // Let's strictly follow: "President image ... should be seen anywhere else" (interpreted as NOT seen).
    // So if validCommonData is empty, we have a problem.
    // Fallback: If no common images, use president image but maybe warn?
    // For now, assume common images exist. If not, use all loadedData to prevent crash.
    const poolData = validCommonData.length > 0 ? validCommonData : loadedData

    const loadedImages = poolData.map((d) => d.img) // Backwards compatibility for logic below

    // --- Performance Optimization: Create Cached Thumbnails ---
    // Increase thumb size for better animation quality (3x base size)
    const thumbSize = Math.ceil(baseSize * 3)

    // Create dual thumbnails: Normal and Blurred
    const thumbnails = loadedImages.map((img) => {
      // 1. Normal Thumbnail
      const c = document.createElement('canvas')
      c.width = thumbSize
      c.height = thumbSize
      const cx = c.getContext('2d')
      if (cx) {
        // Crop and scale to thumbnail
        const minDim = Math.min(img.width, img.height)
        const sx = (img.width - minDim) / 2
        const sy = (img.height - minDim) / 2
        cx.drawImage(img, sx, sy, minDim, minDim, 0, 0, thumbSize, thumbSize)
      }

      // 2. Blurred Thumbnail
      const bc = document.createElement('canvas')
      bc.width = thumbSize
      bc.height = thumbSize
      const bcx = bc.getContext('2d')
      if (bcx) {
        bcx.filter = 'blur(6px)' // Bake the blur. 6px at thumbnail scale ~ 2px at screen scale? Check.
        // Actually, thumbSize is 3x baseSize.
        // If we want 3px blur on screen (baseSize), and we draw thumb at baseSize scale...
        // ...then we need 3px * 3 = 9px blur on thumbnail?
        // Let's try 6px for a good balance of smoothness and perf.
        bcx.drawImage(c, 0, 0)
      }

      return { normal: c, blurred: bc }
    })

    // Pixel data for hit testing mask
    const maskData = mCtx.getImageData(0, 0, width, height).data

    let attempts = 0

    while (placements.length < targetCount && attempts < maxAttempts) {
      attempts++

      const cx = Math.random() * width
      const cy = Math.random() * height

      // 1. Check Mask (Fast fail)
      const pixelIndex = (Math.floor(cy) * width + Math.floor(cx)) * 4
      if (maskData[pixelIndex + 3] <= 128) continue // Must be inside text

      // 2. Determine Size
      // Slight variation for organic feel, but mostly uniform for visibility
      const sizeMultiplier = 0.85 + Math.random() * 0.4
      const targetSize = baseSize * sizeMultiplier
      const w = targetSize // Square tiles
      const h = targetSize
      const radius = targetSize / 2

      // 3. Collision Check (Ensure clear visibility)
      // Distance threshold = sum of radii * 0.85
      let collision = false

      for (let i = 0; i < placements.length; i++) {
        const p = placements[i]
        const dx = cx - p.cx
        const dy = cy - p.cy
        const distSq = dx * dx + dy * dy

        const r2 = p.w / 2
        const minDist = (radius + r2) * 0.7

        if (distSq < minDist * minDist) {
          collision = true
          break
        }
      }

      if (collision) continue

      // 4. Place
      const set = thumbnails[placements.length % thumbnails.length]
      const srcImg = loadedImages[placements.length % loadedImages.length]

      placements.push({
        cx,
        cy,
        w,
        h,
        angle: 0, // No rotation
        img: srcImg, // High Res
        thumb: set.normal, // Low Res
        blurredThumb: set.blurred, // Pre-blurred
        isDot: false,
        group: cx < iX ? 'J' : cx < oX ? 'I' : 'O',
      })
    }

    // --- 3. I-Dot (Big Circle) ---
    const iCenterX = iX + i.width / 2
    const dotRadius = fontSize * 0.1
    const dotY = centerY - fontSize * 0.38

    // Dot Image Logic
    // Use president image if available, else first common image
    const dotImage = presidentData ? presidentData.img : loadedImages[0]
    placements.push({
      cx: iCenterX,
      cy: dotY,
      w: dotRadius * 2,
      h: dotRadius * 2,
      angle: 0,
      img: dotImage,
      thumb: dotImage, // Dot uses High Res for everything
      // No blurred thumb for Dot, we'll handle it manually or it doesn't matter as there is only 1 dot
      isDot: true,
      group: 'DOT',
    })

    placementsRef.current = placements

    // --- ANIMATION CONFIGURATION ---

    // Easing Functions
    // Elastic Out: for the bounce/jump effect
    const easeOutElastic = (x: number): number => {
      const c4 = (2 * Math.PI) / 3
      return x === 0
        ? 0
        : x === 1
        ? 1
        : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1
    }

    // Soft Back/Overshoot for smoother particle arrival
    const easeOutBack = (x: number): number => {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
    }

    // Cubic Out for smooth slide
    const easeOutCubic = (x: number): number => {
      return 1 - Math.pow(1 - x, 3)
    }

    // Timings (ms)
    // Sequence: J -> i -> o -> Dot
    // "Clear pauses between each letter reveal"
    const DELAY_BETWEEN_LETTERS = 600
    const LETTER_ANIM_DURATION = 1500 // Slower for "gathering" feel

    const J_START = 300
    const I_START = J_START + LETTER_ANIM_DURATION + DELAY_BETWEEN_LETTERS // J ends then pause
    const O_START = I_START + LETTER_ANIM_DURATION + DELAY_BETWEEN_LETTERS
    const DOT_START = O_START + LETTER_ANIM_DURATION + DELAY_BETWEEN_LETTERS
    const DOT_DURATION = 1200 // Drop/Pop
    const TOTAL_DURATION = DOT_START + DOT_DURATION + 1000

    // Prepare Animation State
    // We want particles to start "scattered".
    // "Gathering together" -> Start far away, end at target.

    const animPlacements = placements.map((p) => {
      // Random scatter origin
      // Scatter range: +/- 400px to 800px?
      const angle = Math.random() * Math.PI * 2
      const dist = 300 + Math.random() * 500

      // For 'Gathering', they come FROM these positions TO cx,cy
      // But for "J", "i", "o", let's make them flow directionally?
      // Random is "particles gathering".

      let sx = p.cx + Math.cos(angle) * dist
      let sy = p.cy + Math.sin(angle) * dist

      // Special case for DOT: "Drops gently from above"
      if (p.isDot) {
        sx = p.cx
        sy = p.cy - 600 // Start from above
      }

      return {
        ...p,
        sx,
        sy,
        currX: sx,
        currY: sy,
        currScale: 0,
        currOpacity: 0,
        // Add slight randomness to duration per particle for organic feel
        durationOffset: (Math.random() - 0.5) * 400,
      }
    })

    const startTime = performance.now()

    const animate = (time: number) => {
      const elapsed = time - startTime

      // 1. Clear Canvas (we need to redraw frame by frame for animation)
      // Optimization: partial clear? No, letters appear sequentially.
      // We can just draw background.
      // 1. Clear Canvas (we need to redraw frame by frame for animation)
      // Transparent background
      ctx.clearRect(0, 0, width, height)

      // Draw Title "HAMNE BANAYA"
      // Full-width Glow Gradient behind text
      // Glow Gradient Box REMOVED
      // ctx.save()
      // ctx.fillStyle = textGlow
      // ctx.fillRect(0, 0, width, glowHeight)
      // ctx.restore()

      // Draw Title "HAMNE BANAYA"
      ctx.save()

      // Animation for Title
      const titleStart = 100
      const titleDur = 1000
      let titleProgress = (elapsed - titleStart) / titleDur
      if (titleProgress < 0) titleProgress = 0
      if (titleProgress > 1) titleProgress = 1

      const titleEase = easeOutCubic(titleProgress)
      const titleOpacity = titleProgress
      const titleYOffset = (1 - titleEase) * 50 // Slide up 50px

      // Retrieve font family from CSS variable on BODY
      const fontName =
        getComputedStyle(document.body)
          .getPropertyValue('--font-shadows-into-light')
          .trim() || 'Arial'
      ctx.font = `900 ${
        fontSize * 0.12
      }px ${fontName}, "Shadows Into Light", cursive, Arial`
      ctx.fillStyle = `rgba(255, 255, 255, ${titleOpacity})`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.letterSpacing = '0.2em'

      // Gradient Fill for Text (Jio Blue Theme)
      const textGradient = ctx.createLinearGradient(width/2 - width*0.2, 0, width/2 + width*0.2, 0)
      textGradient.addColorStop(0, '#6366f1') // Indigo-500
      textGradient.addColorStop(0.5, '#a5b4fc') // Indigo-300
      textGradient.addColorStop(1, '#818cf8') // Indigo-400
      
      ctx.fillStyle = textGradient
      
      // Simulate Bold using Stroke
      ctx.strokeStyle = textGradient
      ctx.lineWidth = fontSize * 0.006 // Adjust thickness as needed
      ctx.strokeText('HUMNE BANAYA', width / 2, height * 0.05 + titleYOffset)
      ctx.fillText('HUMNE BANAYA', width / 2, height * 0.05 + titleYOffset)
      ctx.restore()

      // Restore mask context logic?
      // Logic: Draw tiles -> Apply Mask.
      // But animations might be OUTSIDE the mask if they are flying in.
      // "Mosaic fragments" implies they are shaped.
      // If we apply mask globally, flying particles will disappear outside text boundaries.
      // We want them to be visible AS they fly in?
      // "Forms from mosaic particles gathering... into a perfect 'o'"
      // Usually better to mask ONLY the final state.
      // BUT, if they are "mosaic particles", they are usually just square tiles.
      // Let's draw them raw.

      // Loop through all particles
      // Optimization: Iterate only relevant groups based on time?
      // Doing 6000 particles JS loop is fine.

      // Enable Blur for "Raw" phase
      // Optimization: Removed global filter.
      // ctx.filter = 'blur(3px)' <-- REMOVED

      animPlacements.forEach((p) => {
        // Determine phase
        let startT = 0
        let dur = LETTER_ANIM_DURATION + p.durationOffset

        if (p.group === 'J') startT = J_START
        else if (p.group === 'I') startT = I_START
        else if (p.group === 'O') startT = O_START
        else if (p.group === 'DOT') {
          startT = DOT_START
          dur = DOT_DURATION // Dot is single item, no noise needed really
        }

        // Time relative to this particle's start
        const t = elapsed - startT

        if (t < 0) {
          // Not started yet.
          // "Screen starts empty" -> Do not draw.
          // "Small mosaic particles subtly floating hinting formation" -> maybe draw tiny faint ones?
          if (t > -1000 && !p.isDot) {
            // Hint 1s before
            // Tiny drift
            // const drift = Math.sin((elapsed + p.cx)/500) * 10
            // ctx.globalAlpha = 0.1
            // ctx.drawImage(...)
          }
          return
        }

        // Progress 0 -> 1
        let progress = t / dur
        if (progress > 1) progress = 1

        // Easing
        let eased = 0
        if (p.group === 'DOT') {
          // "Drops gently... subtle pop"
          // easeOutBounce or Elastic
          eased = easeOutElastic(progress) // High bounce
          // Or stick to easeOutBack for controlled drop
          // eased = easeOutBack(progress)
        } else {
          // Letters
          // "Soft jump / bounce animation as it lands"
          // easeOutBack produces a nice overshoot (lands past, then settles)
          eased = easeOutBack(progress)
        }

        // Interpolate Position
        // Start (sx, sy) -> End (cx, cy)
        // Value = Start + (End - Start) * eased
        const x = p.sx + (p.cx - p.sx) * eased
        const y = p.sy + (p.cy - p.sy) * eased

        // Scale / Opacity
        // "Mosaic to solid" -> Opacity 0 -> 1
        const opacity = Math.min(progress * 1.5, 1) // Fade in faster
        // Scale? Maybe pop up from 0?
        // let scale = progress
        // if (scale > 1) scale = 1
        // Actually, keep scale 1, just move.

        // Draw
        // img can be Canvas or Image
        // If thumbnail, it is already square and cropped.
        // If Dot (loadedImages[0]), it is the original Image (rectangular)

        ctx.globalAlpha = opacity

        // Dot Handling (Unique)
        if (p.isDot) {
          // Temporarily disable blur for Dot? User said "images in mosaic".
          // Dot is part of mosaic. Let's keep it blurred or maybe sharper?
          // "Raw mosaic should have blurred images".
          // We can apply blur filter JUST for the dot if needed, but it's one item.
          // Let's try 3px blur only for dot as per request.

          ctx.filter = 'blur(3px)'

          // DOT uses the original high-res image
          // (p.img is set to loadedImages[0] below, not a thumbnail)

          // Circle
          const radius = p.w / 2
          const dropProgress = Math.min(t / DOT_DURATION, 1)
          const dropEased = easeOutBack(dropProgress)

          const dotY = p.sy + (p.cy - p.sy) * dropEased
          const currentRad = radius

          ctx.save()
          ctx.beginPath()
          ctx.arc(p.cx, dotY, currentRad, 0, Math.PI * 2)
          ctx.closePath()
          ctx.clip()

          // Draw Original Image (p.img)
          const minDim = Math.min(p.img.width, p.img.height) // Dot is always Image
          // Ensure we handle both types if Typescript complains, but runtime logic:
          const imgWidth = p.img.width
          const imgHeight = p.img.height

          const ratio = Math.max(p.w / imgWidth, p.h / imgHeight)
          const nw = imgWidth * ratio
          const nh = imgHeight * ratio
          const nix = p.cx - p.w / 2 + (p.w - nw) / 2
          const niy = dotY - p.h / 2 + (p.h - nh) / 2

          ctx.drawImage(p.img, nix, niy, nw, nh)
          ctx.restore()

          ctx.filter = 'none' // Immediately reset
        } else {
          // Standard Tile (Use Thumbnail for Performance)
          // Optimization: Don't draw if opacity ~ 0
          if (opacity > 0.01) {
            // Thumbnails are pre-cropped squares.
            // Just draw whole thing scaling to target w/h

            // Use Blurred thumbnail for animation
            if (p.blurredThumb && p.blurredThumb instanceof HTMLCanvasElement) {
              ctx.drawImage(p.blurredThumb, x - p.w / 2, y - p.h / 2, p.w, p.h)
            } else {
              ctx.drawImage(p.thumb, x - p.w / 2, y - p.h / 2, p.w, p.h)
            }
          }
        }

        ctx.globalAlpha = 1.0
      })

      // Reset filter so it doesn't bleed to next frame items (like text if order changes)
      // ctx.filter = 'none' // Already handled inside local loops if used

      if (elapsed < TOTAL_DURATION) {
        requestAnimationFrame(animate)
      } else {
        // Final cleanup: Snap to exact positions to correct any easing float drift
        // And draw mask one final time for perfect edges
        // (Optional: "particles gathering" implies edges might be rough until end?)

        // Draw Masked Final State
        const perfectMosaicCanvas = document.createElement('canvas')
        perfectMosaicCanvas.width = width
        perfectMosaicCanvas.height = height
        const pmCtx = perfectMosaicCanvas.getContext('2d')
        if (pmCtx) {
          placements.forEach((p) => {
            const minDim = Math.min(p.img.width, p.img.height)
            const sx = (p.img.width - minDim) / 2
            const sy = (p.img.height - minDim) / 2
            pmCtx.drawImage(
              p.img,
              sx,
              sy,
              minDim,
              minDim,
              p.cx - p.w / 2,
              p.cy - p.h / 2,
              p.w,
              p.h
            )
          })

          // Mask
          pmCtx.globalCompositeOperation = 'destination-in'
          pmCtx.drawImage(maskCanvas, 0, 0)
          pmCtx.globalCompositeOperation = 'source-over'

          // Draw Final Canvas
          ctx.clearRect(0, 0, width, height)
          // Background is transparent now
          // ctx.fillStyle = gradient
          // ctx.fillRect(0, 0, width, height)

          // Full-width Glow Gradient behind text (Final)
          // Final Glow Gradient Box REMOVED
          // ctx.fillStyle = textGlow
          // ctx.fillRect(...)

          // Draw Title "HMNE BANAYA" (Final)
          ctx.save()
          // Ensure variable is fresh or reused correctly
          const finalFontName =
            getComputedStyle(document.body)
              .getPropertyValue('--font-shadows-into-light')
              .trim() || 'Arial'
          ctx.font = `900 ${
            fontSize * 0.12
          }px ${finalFontName}, "Shadows Into Light", cursive, Arial`
          
          // Gradient Fill (Final)
          const finalTextGradient = ctx.createLinearGradient(width/2 - width*0.2, 0, width/2 + width*0.2, 0)
          finalTextGradient.addColorStop(0, '#6366f1')
          finalTextGradient.addColorStop(0.5, '#a5b4fc') 
          finalTextGradient.addColorStop(1, '#818cf8')
          ctx.fillStyle = finalTextGradient

          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.letterSpacing = '0.2em'

          // Simulate Bold using Stroke (Final)
          ctx.strokeStyle = finalTextGradient
          ctx.lineWidth = fontSize * 0.006
          ctx.strokeText('HUMNE BANAYA', width / 2, height * 0.05)
          ctx.fillText('HUMNE BANAYA', width / 2, height * 0.05)
          ctx.restore()

          // Ensure unblurred for final result
          ctx.filter = 'none'
          ctx.drawImage(perfectMosaicCanvas, 0, 0)

          // Draw Dot (Manually on top)
          const dotP = placements.find((x) => x.isDot)
          if (dotP) {
            ctx.save()
            ctx.beginPath()
            ctx.arc(dotP.cx, dotP.cy, dotP.w / 2, 0, Math.PI * 2)
            ctx.closePath()
            ctx.clip()
            const minDim = Math.min(dotP.img.width, dotP.img.height)
            const sx = (dotP.img.width - minDim) / 2
            const sy = (dotP.img.height - minDim) / 2
            // Recalc standard draw
            const dw = dotP.w
            const dh = dotP.h
            ctx.drawImage(
              dotP.img,
              sx,
              sy,
              minDim,
              minDim,
              dotP.cx - dw / 2,
              dotP.cy - dh / 2,
              dw,
              dh
            )
            ctx.restore()
          }
        }

        setDownloadUrl(canvas.toDataURL('image/png'))
        setIsGenerating(false)
      }
    }

    requestAnimationFrame(animate)
  }

  useEffect(() => {
    // Start the auto-popup loop only when generation is done and we have images
    if (isGenerating || !images || images.length === 0) return

    const triggerPopup = () => {
      // Don't auto-popup if user has interacted recently (e.g., last 2 seconds)
      if (Date.now() - lastInteractionRef.current < 2000) return
      if (activeTile && isExpanded) return // Don't interrupt

      const placements = placementsRef.current
      if (placements.length === 0) return

      let p: Placement | undefined

      if (popupCountRef.current === 0) {
        p = placements.find((x) => x.isDot)
      }

      if (!p) {
        const randomIndex = Math.floor(Math.random() * placements.length)
        p = placements[randomIndex]
      }

      popupCountRef.current++

      const rect = getTileRect(p)
      if (!rect) return

      // Trigger Animation
      const screenW = window.innerWidth
      const screenH = window.innerHeight

      // Calculate limit (55% of screen to show background)
      const maxW = screenW * 0.35
      const maxH = screenH * 0.35

      // Image intrinsic dims
      const imgW = p.img.width
      const imgH = p.img.height

      // Scale to fit
      const scale = Math.min(maxW / imgW, maxH / imgH)
      const targetW = imgW * scale
      const targetH = imgH * scale

      // Centered position
      const targetX = (screenW - targetW) / 2
      const targetY = (screenH - targetH) / 2

      setActiveTile({
        img: getImgSrc(p.img),
        rect,
        id: Math.random(),
        target: { x: targetX, y: targetY, w: targetW, h: targetH },
      })

      // Expand after a tick
      setTimeout(() => {
        setIsExpanded(true)
      }, 50)

      // Close after shorter duration (User requested "reduce pop-up image time")
      setTimeout(() => {
        setIsExpanded(false)
        setTimeout(() => {
          setActiveTile(null)
        }, 600) // Faster transition back
      }, 1200) // Reduced from 1700
    }

    // Initial trigger for "instant" feel
    const initialTimer = setTimeout(triggerPopup, 1000)

    const intervalId = setInterval(triggerPopup, 1500) // Interval 1.5 seconds per user request

    return () => {
      clearTimeout(initialTimer)
      clearInterval(intervalId)
    }
  }, [isGenerating, images, activeTile, isExpanded])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    lastInteractionRef.current = Date.now()
    const canvas = canvasRef.current
    if (!canvas) return

    // If we are currently "auto-expanding", do we cancel it?
    // For now, let's just let the mouse take over tracking, but maybe not expand fully?
    // The user asked for "expands... into a modal view".
    // Doing that on *hover* usually feels too aggressive (popup blocking view).
    // Let's keep the hover as a "mini-expand" or just highlight,
    // OR if the user really wants the same effect, we can do it.
    // Given the prompt "animation on live preview wall like automatically pop-ups",
    // I will interpret the 'modal expand' primarily for the auto-show.
    // For Hover, I will keep a more subtle pop-up or just show the same modal but maybe faster?
    // Let's apply the same effect but maybe standard hover logic is better for UX.
    // Actually, let's treat hover as: "Pause auto, show preview near cursor" (classic tooltip)
    // OR "Expand this tile".
    // Let's stick to the previous hover behavior (follow mouse) but maybe smoother?
    // Wait, the user prompt was specifically about "animation on live preview wall... automatically pop-ups".
    // Then "Design an image pop-up animation... expanding... into a modal".
    // It sounds like this is the *visual style* for the pop-ups.

    // I will implement the "Hover" to set the active tile, but maybe we don't "Modal" it immediately?
    // Or do we? If I hover a tile, does it fly to the center? That would be chaotic.
    // Compromise:
    // Compromise:
    // Auto-mode: Flies to center.
    // Hover-mode: Just scales up in place (or slight pop).

    // However, I need to replace the OLD logic.
    // I'll re-implement hit testing.

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY

    let found: Placement | null = null
    for (let i = placementsRef.current.length - 1; i >= 0; i--) {
      const p = placementsRef.current[i]
      if (p.isDot) {
        const dx = mouseX - p.cx
        const dy = mouseY - p.cy
        if (dx * dx + dy * dy <= (p.w / 2) * (p.w / 2)) {
          found = p
          break
        }
      } else {
        const dx = mouseX - p.cx
        const dy = mouseY - p.cy
        const cos = Math.cos(-p.angle)
        const sin = Math.sin(-p.angle)
        const localX = dx * cos - dy * sin
        const localY = dx * sin + dy * cos
        if (
          localX >= -p.w / 2 &&
          localX <= p.w / 2 &&
          localY >= -p.h / 2 &&
          localY <= p.h / 2
        ) {
          found = p
          break
        }
      }
    }

    if (found) {
      // Check if we are already showing this one to avoid flicker
      // For hover, let's just show a simple floating tooltip-like expansion
      // instead of the full center-modal logic which is disruptive on hover.
      setHoveredImage(getImgSrc(found.img))
      setPopupPosition({ x: e.clientX, y: e.clientY })

      // If an auto-animation is active, we should probably kill it?
      if (activeTile && activeTile.id !== 'hover') {
        setIsExpanded(false)
        setActiveTile(null)
      }
    } else {
      setHoveredImage(null)
    }
  }

  const handleMouseLeave = () => {
    lastInteractionRef.current = Date.now()
    setHoveredImage(null)
  }

  return (
    <div
      style={{
        width: '100%',
        marginTop: '0px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '100%',
        // Removed fixed marginTop of 40px to fit container
        background: '#041d40', // Match canvas edge for seamless letterboxing (Solid Color)
      }}
      className='fixed inset-0 w-screen min-h-screen flex flex-col items-center justify-center p-0 m-0 overflow-hidden' // Force full viewport
    >
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          border: '1px solid #333',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 0 50px rgba(0,0,0,0.5)',
          cursor: 'crosshair',
          // background: '#041d40', // REMOVED
          width: '100%',
          height: '100%', // Maximizing height
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        className='relative w-full min-h-screen bg-[#020617] overflow-hidden'
      >
        {/* Background Gradients - Jio Blue Theme */}
        <div className='absolute top-0 left-0 w-full h-3/4 bg-blue-600/20 blur-[150px] rounded-full pointer-events-none' />
        <div className='absolute bottom-0 right-0 w-3/4 h-3/4 bg-sky-600/20 blur-[130px] rounded-full pointer-events-none' />

        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            width: '100%',
            height: '100%', // Fill container
            maxWidth: '100%',
            maxHeight: '100%', // Prevent scrolling if possible
            objectFit: 'contain',
            display: 'block',
          }}
          className='w-full h-full object-contain relative z-10'
        />

        {/* Hover Popup (Follows Cursor) */}
        {hoveredImage && (
          <div
            style={{
              position: 'fixed',
              left: popupPosition.x + 15,
              top: popupPosition.y + 15,
              width: '200px',
              height: '200px',
              backgroundImage: `url(${hoveredImage})`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              backgroundBlendMode: 'overlay',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '12px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              zIndex: 100,
              pointerEvents: 'none',
              animation: 'fadeIn 0.2s ease',
            }}
          ></div>
        )}

        {/* Auto-Expanding Modal Animation */}
        {activeTile && (
          <div
            style={{
              position: 'fixed',
              zIndex: 1000,
              backgroundImage: `url(${activeTile.img})`,
              backgroundPosition: 'center',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundColor: isExpanded ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
              backdropFilter: isExpanded ? 'blur(12px)' : 'none',
              boxShadow: isExpanded
                ? '0 0 100px rgba(0,255,0,0.3), inset 0 0 20px rgba(255,255,255,0.1)'
                : '0 20px 50px rgba(0,0,0,0.8)',
              border: isExpanded ? '1px solid rgba(255,255,255,0.2)' : 'none',

              // Dynamic positioning
              top: isExpanded ? activeTile.target.y : activeTile.rect.y,
              left: isExpanded ? activeTile.target.x : activeTile.rect.x,
              width: isExpanded ? activeTile.target.w : activeTile.rect.w,
              height: isExpanded ? activeTile.target.h : activeTile.rect.h,

              transition: 'all 1.2s cubic-bezier(0.19, 1, 0.22, 1)',
              pointerEvents: 'none',
              // Change border radius to flat bottom when expanded (to connect with footer)
              borderRadius: isExpanded ? '16px 16px 0 0' : '16px',
            }}
          >
            {/* White Footer Card Section */}
            <div
              style={{
                position: 'absolute',
                top: '100%', // Position directly below the image
                left: 0,
                width: '100%',
                height: 'auto',
                background: 'white',
                padding: '12px 0',
                borderRadius: '0 0 16px 16px', // Rounded bottom corners
                textAlign: 'center',
                opacity: isExpanded ? 1 : 0,
                transform: isExpanded ? 'scale(1)' : 'scale(0.5)',
                transformOrigin: 'top center',
                transition: isExpanded
                  ? 'opacity 0.6s, transform 0.6s' // Enter: Sync with image
                  : 'opacity 0.3s, transform 0.3s', // Exit: Fast
                boxShadow: isExpanded ? '0 10px 30px rgba(0,0,0,0.5)' : 'none',
              }}
            >
              <span
                style={{
                  color: '#030055', // Deep Jio Blue
                  fontSize: '0.9rem', // Reduced to fit single line
                  fontWeight: '800',
                  fontStyle: 'italic',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                #MaineBanayaJio
              </span>
            </div>
          </div>
        )}
        {downloadUrl && (
          <a
            href={downloadUrl}
            style={{
              position: 'absolute',
              bottom: '30px',
              right: '30px', // Moved to bottom right
              zIndex: 2000, // Ensure on top of everything
              width: 'auto',
              height: 'auto',
            }}
            className='group bg-white/10 backdrop-blur-md border border-white/20 text-white p-3 rounded-full font-semibold shadow-lg hover:bg-white/20 transition-all flex items-center gap-3'
            title='Download Mosaic'
            download='jio-mosaic.png'
          >
            {/* <span className="text-sm tracking-wide">Download</span> */}
            <svg
              width='24'
              height='24'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2.5'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
              <polyline points='7 10 12 15 17 10' />
              <line x1='12' y1='15' x2='12' y2='3' />
            </svg>
          </a>
        )}
      </div>
    </div>
  )
}
