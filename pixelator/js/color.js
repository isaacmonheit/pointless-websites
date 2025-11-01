// ============================================================================
// COLOR GENERATION (MATCHES ORIGINAL PIXELATOR)
// ============================================================================

/**
 * Generates a color based on seed and index with mix ratio control
 */
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
 * Generates a random color palette (array of 256 colors, NOT sorted)
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

/**
 * Find closest color in palette by comparing brightness
 */
function matchToPalette(originalColor, palette) {
  const originalBrightness = (originalColor[0] + originalColor[1] + originalColor[2]) / 3;
  let closestMatch = palette[0];
  let smallestDifference = Number.MAX_VALUE;

  for (const color of palette) {
    const colorBrightness = (color[0] + color[1] + color[2]) / 3;
    const difference = Math.abs(originalBrightness - colorBrightness);

    if (difference < smallestDifference) {
      smallestDifference = difference;
      closestMatch = color;
    }
  }
  return closestMatch;
}

/**
 * Replace all colors with palette colors (matches original algorithm)
 */
function replaceColors(imageData) {
  const palette = getRandomPalette();

  for (let i = 0; i < imageData.data.length; i += 4) {
    const originalColor = [imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]];
    const newColor = matchToPalette(originalColor, palette);

    imageData.data[i] = newColor[0];
    imageData.data[i + 1] = newColor[1];
    imageData.data[i + 2] = newColor[2];
  }
  return imageData;
}
