function generateSubduedColor(seed, index) {
  const mixRatio = mixRatioValue;
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
 * Generates a random color palette (array of 256 colors)
 */
function getRandomPalette() {
  const palette = [];
  let seed = useFixedSeed ? currentSeed : generateRandomSeed();

  for (let i = 0; i < 256; i++) {
    palette.push(generateSubduedColor(seed, i));
  }

  if (!useFixedSeed) {
    currentSeed = seed;
    const seedInput = document.getElementById('seedInput');
    if (seedInput) seedInput.value = currentSeed;
  }

  return palette;
}

// Cache for the precomputed lookup table
let cachedLUT = null;
let cachedParams = null;

/**
 * Precomputes a FULL LUT that matches the original matchToPalette algorithm
 * For each possible brightness 0-255, pre-compute which palette color is closest
 */
function precomputeFullLUT() {
  // Check if we can reuse cached LUT
  const params = `${currentSeed}_${mixRatioValue}_${brightnessValue}`;
  if (cachedLUT && cachedParams === params) {
    return cachedLUT;
  }

  // Generate palette (same as original - unsorted array of 256 colors)
  const palette = getRandomPalette();

  // Pre-compute palette brightnesses once
  const paletteBrightnesses = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    paletteBrightnesses[i] = (palette[i][0] + palette[i][1] + palette[i][2]) / 3;
  }

  // Precompute full LUT: for each input brightness, find closest palette color
  const fullLUT = new Uint8ClampedArray(256 * 3); // 256 entries × 3 channels

  for (let inputBrightness = 0; inputBrightness < 256; inputBrightness++) {
    // Find closest match (same logic as matchToPalette, but pre-computed)
    let closestIndex = 0;
    let smallestDifference = Math.abs(paletteBrightnesses[0] - inputBrightness);

    for (let j = 1; j < 256; j++) {
      const difference = Math.abs(paletteBrightnesses[j] - inputBrightness);
      if (difference < smallestDifference) {
        smallestDifference = difference;
        closestIndex = j;
      }
    }

    // Store the closest color
    const color = palette[closestIndex];
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
 * Replace all colors with palette colors using precomputed LUT
 * Single pass, no redundant calculations
 */
function replaceColors(imageData) {
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

