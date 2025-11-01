// ============================================================================
// COLOR GENERATION
// ============================================================================

/**
 * Generates a color based on seed and index with saturation control
 */
function generateSubduedColor(seed, index) {
  const mixRatio = 1 - saturationValue; // high sat -> more color, low -> grey-ish
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
 * Replace all colors with palette colors (brightness-mapped)
 */
function replaceColors(imageData) {
  const lookupTable = getRandomPalette();
  const data = imageData.data;
  const length = data.length;

  for (let i = 0; i < length; i += 4) {
    let brightness = ((data[i] + data[i + 1] + data[i + 2]) / 3) | 0;
    brightness = ((brightness - 128) * contrastValue + 128) | 0;
    brightness = Math.max(0, Math.min(255, brightness));

    const newColor = lookupTable[brightness];
    data[i] = newColor[0];
    data[i + 1] = newColor[1];
    data[i + 2] = newColor[2];
  }

  return imageData;
}
