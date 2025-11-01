// ============================================================================
// OPTIMIZED COLOR GENERATION WITH PRECOMPUTED LUT
// ============================================================================

// Cache for the precomputed lookup table
let cachedLUT = null;
let cachedParams = null;

/**
 * Generates a color based on seed and index with saturation control
 */
function generateSubduedColor(seed, index) {
  const mixRatio = 1 - saturationValue;
  const baseSeed = seed;
  const rnd1 = seededRandom(baseSeed + index);
  const rnd2 = seededRandom(baseSeed + index + 256);
  const rnd3 = seededRandom(baseSeed + index + 512);

  return [
    Math.floor(rnd1 * 256 * (1 - mixRatio) + brightnessValue * mixRatio),
    Math.floor(rnd2 * 256 * (1 - mixRatio) + brightnessValue * mixRatio),
    Math.floor(rnd3 * 256 * (1 - mixRatio) + brightnessValue * mixRatio)
  ];
}

/**
 * Generates a random color palette with brightness lookup table
 */
function getRandomPalette() {
  let seed = useFixedSeed ? currentSeed : generateRandomSeed();

  const colors = [];
  for (let i = 0; i < PALETTE_SIZE; i++) {
    colors.push(generateSubduedColor(seed, i));
  }

  if (!useFixedSeed) {
    currentSeed = seed;
    const seedInput = document.getElementById('seedInput');
    if (seedInput) seedInput.value = currentSeed;
  }

  const colorsByBrightness = colors
    .map((color) => ({
      color,
      brightness: (color[0] + color[1] + color[2]) / 3
    }))
    .sort((a, b) => a.brightness - b.brightness);

  const lookupTable = new Array(256);
  let colorIndex = 0;

  for (let brightness = 0; brightness < 256; brightness++) {
    while (
      colorIndex < colorsByBrightness.length - 1 &&
      Math.abs(colorsByBrightness[colorIndex + 1].brightness - brightness) <
        Math.abs(colorsByBrightness[colorIndex].brightness - brightness)
    ) {
      colorIndex++;
    }
    lookupTable[brightness] = colorsByBrightness[colorIndex].color;
  }

  return lookupTable;
}

/**
 * Precomputes a FULL LUT: luma[0-255] → (contrast/brightness applied) → RGB palette
 * This eliminates per-pixel contrast/brightness calculations
 */
function precomputeFullLUT() {
  // Check if we can reuse cached LUT
  const params = `${currentSeed}_${saturationValue}_${brightnessValue}_${contrastValue}`;
  if (cachedLUT && cachedParams === params) {
    return cachedLUT;
  }

  // Get base palette (256 colors indexed by brightness)
  const basePalette = getRandomPalette();

  // Precompute full LUT: input brightness → contrast/brightness adjusted → final RGB
  const fullLUT = new Uint8ClampedArray(256 * 3); // 256 entries × 3 channels

  for (let inputBrightness = 0; inputBrightness < 256; inputBrightness++) {
    // Apply contrast and brightness adjustment
    let adjustedBrightness = ((inputBrightness - 128) * contrastValue + 128) | 0;
    adjustedBrightness = Math.max(0, Math.min(255, adjustedBrightness));

    // Lookup final color from palette
    const color = basePalette[adjustedBrightness];
    const idx = inputBrightness * 3;
    fullLUT[idx] = color[0];
    fullLUT[idx + 1] = color[1];
    fullLUT[idx + 2] = color[2];
  }

  // Cache the result
  cachedLUT = fullLUT;
  cachedParams = params;

  return fullLUT;
}

/**
 * OPTIMIZED: Replace all colors with palette colors using precomputed LUT
 * Single pass, no redundant calculations
 */
function replaceColorsOptimized(imageData) {
  const lut = precomputeFullLUT();
  const data = imageData.data;
  const length = data.length;

  // Single pass: luma calculation + LUT lookup
  for (let i = 0; i < length; i += 4) {
    // Calculate luma (brightness) - integer math for speed
    const luma = ((data[i] + data[i + 1] + data[i + 2]) / 3) | 0;

    // Direct LUT lookup (no contrast/brightness calc needed!)
    const lutIdx = luma * 3;
    data[i] = lut[lutIdx];
    data[i + 1] = lut[lutIdx + 1];
    data[i + 2] = lut[lutIdx + 2];
    // data[i + 3] (alpha) unchanged
  }

  return imageData;
}

/**
 * Invalidate LUT cache when parameters change
 */
function invalidateLUTCache() {
  cachedLUT = null;
  cachedParams = null;
}

/**
 * Backwards compatibility: use optimized version
 */
function replaceColors(imageData) {
  return replaceColorsOptimized(imageData);
}
