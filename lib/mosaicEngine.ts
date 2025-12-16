export interface MosaicImage {
  url: string;
  isPresident: boolean;
}

export interface MosaicPlacement {
  x: number;
  y: number;
  size: number;
  imageUrl: string;
  region: 'J' | 'I_BODY' | 'I_DOT' | 'O';
}

interface Coordinate {
  x: number;
  y: number;
  region: 'J' | 'I_BODY' | 'I_DOT' | 'O';
}

// Configuration for grid generation (Logical coordinates)
const GRID_SIZE = 1; // logical unit size
const OFFSET_X = 0;
const OFFSET_Y = 0;

/**
 * Generates the grid coordinates for the JIO logo patterns.
 * This is deterministic.
 */
function generateGrid(): Coordinate[] {
  const coords: Coordinate[] = [];
  
  // Define "J"
  // Vertical bar: x=2, y=3..9
  // Hook bottom: x=0..2, y=9 (simplified)
  // Let's make it a bit blockier
  // J Vertical: x=2-3, y=2-8
  // J Hook: x=0-3, y=8-9
  for (let y = 2; y <= 8; y++) {
    for (let x = 2; x <= 3; x++) coords.push({ x, y, region: 'J' });
  }
  for (let y = 8; y <= 9; y++) {
    for (let x = 0; x <= 3; x++) {
      if (x < 2 && y < 8) continue; // skip overlap if any
      coords.push({ x, y, region: 'J' });
    }
  }

  // Define "I"
  // I Body: Vertical bar centered around x=6. x=6-7, y=3-9
  // I Dot: x=6-7, y=0-1
  
  // I_DOT
  for (let x = 6; x <= 7; x++) {
    for (let y = 0; y <= 1; y++) {
      coords.push({ x, y, region: 'I_DOT' });
    }
  }

  // I_BODY
  for (let x = 6; x <= 7; x++) {
    for (let y = 3; y <= 9; y++) {
      coords.push({ x, y, region: 'I_BODY' });
    }
  }

  // Define "O"
  // Approximated circle/ring around center (12, 6)
  // Bounds x=10-14, y=4-8 ?
  // Let's do a square donut or just a filled square for simplicity of grid
  // User asked for "right circular area", let's approximate circle
  const centerO = { x: 12, y: 6 };
  const radius = 3.5;
  
  for (let x = 9; x <= 15; x++) {
    for (let y = 2; y <= 10; y++) {
      const dist = Math.sqrt(Math.pow(x - centerO.x, 2) + Math.pow(y - centerO.y, 2));
      if (dist <= radius) {
        coords.push({ x, y, region: 'O' });
      }
    }
  }

  return coords;
}

const MOSAIC_GRID = generateGrid();

export function generateMosaicLayout(images: MosaicImage[]): MosaicPlacement[] {
  const placements: MosaicPlacement[] = [];
  
  // 1. Separate images
  const presidentImages = images.filter(img => img.isPresident);
  const regularImages = images.filter(img => !img.isPresident);

  // 2. Identify slots
  const dotSlots = MOSAIC_GRID.filter(p => p.region === 'I_DOT');
  const otherSlots = MOSAIC_GRID.filter(p => p.region !== 'I_DOT');

  // 3. Fill I_DOT (President only)
  // Logic: Iterate through dot slots. Cycle through president images if available.
  // If no president images, leave empty (per requirements).
  if (presidentImages.length > 0) {
    dotSlots.forEach((slot, index) => {
      const img = presidentImages[index % presidentImages.length];
      placements.push({
        x: slot.x,
        y: slot.y,
        size: 1, // logical size
        imageUrl: img.url,
        region: 'I_DOT'
      });
    });
  }

  // 4. Fill Other Slots (Regular images)
  // Logic: Cycle through regular images.
  if (regularImages.length > 0) {
    otherSlots.forEach((slot, index) => {
      const img = regularImages[index % regularImages.length];
      placements.push({
        x: slot.x,
        y: slot.y,
        size: 1, // logical size
        imageUrl: img.url,
        region: slot.region
      });
    });
  } else {
    // If no regular images, we could leave empty or maybe use president images?
    // Requirement rule 2: "Images where isPresident === true: Can ONLY be placed in region 'I_DOT'"
    // So we cannot put president images in body.
    // We leave them empty if no regular images.
  }

  return placements;
}
