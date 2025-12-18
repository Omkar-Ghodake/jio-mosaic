'use client'
import React, { useEffect, useRef, useState } from 'react'

interface MosaicCanvasProps {
  imageUrls: string[]
}

interface Placement {
  cx: number
  cy: number
  w: number
  h: number
  angle: number
  img: HTMLImageElement // High Quality Source (for Final & Popup)
  thumb: HTMLCanvasElement | HTMLImageElement // Optimized Cache (for Animation)
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

export default function MosaicCanvas({ imageUrls }: MosaicCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const placementsRef = useRef<Placement[]>([]) // Store placement data for hit testing
  const [downloadUrl, setDownloadUrl] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [hoveredImage, setHoveredImage] = useState<string | null>(null)
  const [activeTile, setActiveTile] = useState<ActiveTile | null>(null) // { img, rect, id }
  const [isExpanded, setIsExpanded] = useState(false)
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 })

  const containerRef = useRef<HTMLDivElement>(null)

  // Track user interaction to prevent auto-popups while exploring
  const lastInteractionRef = useRef(0)
  const popupCountRef = useRef(0)

  // Calculate screen rect for a tile
  const getTileRect = (p: Placement): TileRect | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = rect.width / canvas.width
    const scaleY = rect.height / canvas.height

    // p.cx, p.cy are centers. p.w, p.h are dimensions.
    // We need top-left.
    // But wait, our rectangles are rotated?
    // For the animation, let's ignore rotation for the start rect to keep it simple and clean.
    // Or if we want to be precise, we just use the bounding box of the tile.

    const w = p.w * scaleX
    const h = p.h * scaleY
    const x = rect.left + p.cx * scaleX - w / 2
    const y = rect.top + p.cy * scaleY - h / 2

    return { x, y, w, h }
  }

  // Helper to get source string from placement image (Canvas or Image)
  const getImgSrc = (img: HTMLImageElement | HTMLCanvasElement): string => {
    if (img instanceof HTMLImageElement) return img.src
    return img.toDataURL()
  }

  useEffect(() => {
    if (!imageUrls || imageUrls.length === 0) return

    setHoveredImage(null)
    placementsRef.current = []
    popupCountRef.current = 0

    const loadImages = async () => {
      setIsGenerating(true)

      const processImage = (url: string) => {
        return new Promise<HTMLImageElement | null>((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'Anonymous' // Crucial for Cloudinary/CORS
          img.src = url
          img.onload = () => resolve(img)
          img.onerror = () => resolve(null) // Convert error to null to filter later
        })
      }

      try {
        const results = await Promise.all(imageUrls.map(processImage))
        const validImages = results.filter(
          (img): img is HTMLImageElement => img !== null
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

    loadImages()
  }, [imageUrls])

  const generateMosaic = (loadedImages: HTMLImageElement[]) => {
    const canvas = canvasRef.current
    if (!canvas) return // Guard clause
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const placements: Placement[] = [] // Local array to populate ref

    // Dynamic resolution based on viewport for smooth performance
    // Use devicePixelRatio but cap it at 2 (or 3) to prevent 8K lag on mobile/retina
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    // Get actual display size
    const rect = canvas.getBoundingClientRect()
    const width = Math.floor(rect.width * dpr)
    const height = Math.floor(rect.height * dpr)

    canvas.width = width
    canvas.height = height

    // Clear background
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      100,
      width / 2,
      height / 2,
      width
    )
    gradient.addColorStop(0, '#041d40') // Deep Blue Center
    gradient.addColorStop(1, '#041d40') // Slightly darker Blue Edges (Seamless)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // --- Dynamic Font Sizing (Maximized) ---
    // Create a temporary canvas to measure text
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    // Initial estimate logic
    let fontSize = height // Start big
    tempCtx.font = `900 ${fontSize}px Arial, sans-serif`

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
    const targetWidth = width * 0.95
    const targetHeight = height * 0.95 // Reduced to leave room for button at bottom

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

    const font = `900 ${fontSize}px Arial, sans-serif`

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
    const centerY = height * 0.7 // Shifted down further for gap

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

    // --- Performance Optimization: Create Cached Thumbnails ---
    // Increase thumb size for better animation quality (3x base size)
    const thumbSize = Math.ceil(baseSize * 3)
    const thumbnails = loadedImages.map((img) => {
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
      return c
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
      const srcImg = loadedImages[placements.length % loadedImages.length]
      const thumbImg = thumbnails[placements.length % thumbnails.length]

      placements.push({
        cx,
        cy,
        w,
        h,
        angle: 0, // No rotation
        img: srcImg, // High Res
        thumb: thumbImg, // Low Res
        isDot: false,
        group: cx < iX ? 'J' : cx < oX ? 'I' : 'O',
      })
    }

    // --- 3. I-Dot (Big Circle) ---
    const iCenterX = iX + i.width / 2
    const dotRadius = fontSize * 0.1
    const dotY = centerY - fontSize * 0.38

    // Dot Image Logic
    const dotImage = loadedImages[0]
    placements.push({
      cx: iCenterX,
      cy: dotY,
      w: dotRadius * 2,
      h: dotRadius * 2,
      angle: 0,
      img: dotImage,
      thumb: dotImage, // Dot uses High Res for everything
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
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)

      // Draw Title "HAMNE BANAYA"
      ctx.save()
      ctx.font = `600 ${fontSize * 0.15}px Arial, sans-serif`
      ctx.fillStyle = 'white'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.letterSpacing = '0.2em'
      ctx.fillText('HAMNE BANAYA', width / 2, height * 0.05)
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

      let completed = false

      // Loop through all particles
      // Optimization: Iterate only relevant groups based on time?
      // Doing 6000 particles JS loop is fine.

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
        } else {
          // Standard Tile (Use Thumbnail for Performance)
          // Optimization: Don't draw if opacity ~ 0
          if (opacity > 0.01) {
            // Thumbnails are pre-cropped squares.
            // Just draw whole thing scaling to target w/h
            ctx.drawImage(p.thumb, x - p.w / 2, y - p.h / 2, p.w, p.h)
          }
        }

        ctx.globalAlpha = 1.0
      })

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
          ctx.fillStyle = gradient
          ctx.fillRect(0, 0, width, height)

          // Draw Title "HAMNE BANAYA" (Final)
          ctx.save()
          ctx.font = `600 ${fontSize * 0.15}px Arial, sans-serif`
          ctx.fillStyle = 'white'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.letterSpacing = '0.2em'
          ctx.fillText('HAMNE BANAYA', width / 2, height * 0.05)
          ctx.restore()

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
    if (isGenerating || !imageUrls || imageUrls.length === 0) return

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
  }, [isGenerating, imageUrls, activeTile, isExpanded])

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
          background: '#041d40', // Match canvas edge (Solid)
          width: '100%',
          height: '100%', // Maximizing height
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        className='relative w-full min-h-screen'
      >
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
          className='w-full h-full object-contain'
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
              borderRadius: '16px',
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
            }}
          >
            <div
              style={{
                position: 'absolute',
                bottom: '-60px',
                width: '100%',
                textAlign: 'center',
                color: 'white',
                opacity: isExpanded ? 1 : 0,
                transition: 'opacity 0.6s 0.4s',
                fontSize: '1rem',
                fontWeight: 'bold',
                textShadow: '0 4px 8px black',
              }}
            >
              Featured Selfie
            </div>
          </div>
        )}
        {downloadUrl && (
          <a
            href={downloadUrl}
            download='jio-mosaic.png'
            style={{
              position: 'absolute',
              bottom: '30px',
              right: '30px', // Moved to bottom right
              zIndex: 2000, // Ensure on top of everything
              background: 'linear-gradient(45deg, #0070f3, #030b0cff)', // Consistent Blue Theme
              color: 'white',
              padding: '16px', // Circular padding
              borderRadius: '50%', // Circle
              textDecoration: 'none',
              fontSize: '1rem',
              fontWeight: 'bold',
              boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
              transform: 'translateZ(0)', // Force GPU render layer
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '60px',
              height: '60px',
            }}
            className='hover:scale-105 transition-transform active:scale-95 text'
            title='Download Mosaic'
          >
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
