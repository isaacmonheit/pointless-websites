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
