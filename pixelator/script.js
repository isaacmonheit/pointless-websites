// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_CANVAS_DIMENSION = 800;
const PALETTE_SIZE = 256;
const DEBOUNCE_DELAY = 1;
const DEFAULT_BLUR_VALUE = 5;
const SHIFT_SPEED_OFFSET = 5200;

// ============================================================================
// STATE VARIABLES
// ============================================================================

let pixelationValue = 10;
let saturationValue = 0.5;
let brightnessValue = 128;
let contrastValue = 1.0;
let currentSeed = 0;
let useFixedSeed = false;
let currentImageSrc = null;
let originalImageSrc = null;
let shiftInterval = null;
let isShifting = false;

// Store the pixelated intermediate (before color replacement) for fast shifting
let pixelatedIntermediate = null;

// Off-screen canvases for image processing (reused to avoid allocation overhead)
let offScreenCanvas = document.createElement('canvas');
let offScreenCtx = offScreenCanvas.getContext('2d');
let tempCanvas = document.createElement('canvas');
let tempCtx = tempCanvas.getContext('2d');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Simple seedable random number generator
 * @param {number} seed - The seed value
 * @returns {number} A pseudo-random number between 0 and 1
 */
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Generates a random seed value
 * @returns {number} A random seed between 0 and 9999
 */
function generateRandomSeed() {
  return Math.floor(Math.random() * 10000);
}

/**
 * Debounce function to limit event handler execution
 * @param {Function} func - The function to debounce
 * @param {number} delay - The delay in milliseconds
 * @returns {Function} The debounced function
 */
function debounce(func, delay) {
  let debounceTimer;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(context, args), delay);
  };
}

// ============================================================================
// COLOR GENERATION
// ============================================================================

/**
 * Generates a color based on seed and index with saturation control
 * @param {number} seed - The seed value for color generation
 * @param {number} index - The index in the palette
 * @returns {Array<number>} RGB color array
 */
function generateSubduedColor(seed, index) {
  // Invert saturation: high saturation = more color, low saturation = more grey
  const mixRatio = 1 - saturationValue;
  const baseSeed = seed;
  const rnd1 = seededRandom(baseSeed + index);
  const rnd2 = seededRandom(baseSeed + index + 256);
  const rnd3 = seededRandom(baseSeed + index + 512);

  return [
    Math.floor((rnd1 * 256 * (1 - mixRatio)) + (brightnessValue * mixRatio)),
    Math.floor((rnd2 * 256 * (1 - mixRatio)) + (brightnessValue * mixRatio)),
    Math.floor((rnd3 * 256 * (1 - mixRatio)) + (brightnessValue * mixRatio))
  ];
}

/**
 * Generates a random color palette with brightness lookup table
 * @returns {Array<Array<number>>} Brightness-indexed array (256 entries) of RGB color arrays
 */
function getRandomPalette() {
  const palette = [];
  let seed = useFixedSeed ? currentSeed : generateRandomSeed();

  // Generate palette colors
  const colors = [];
  for (let i = 0; i < PALETTE_SIZE; i++) {
    colors.push(generateSubduedColor(seed, i));
  }

  if (!useFixedSeed) {
    currentSeed = seed;
    document.getElementById('seedInput').value = currentSeed;
  }

  // Create brightness-indexed lookup table
  // Pre-calculate brightness for each color and sort by brightness
  const colorsByBrightness = colors.map(color => ({
    color: color,
    brightness: (color[0] + color[1] + color[2]) / 3
  })).sort((a, b) => a.brightness - b.brightness);

  // Create 256-entry lookup table for O(1) color matching
  const lookupTable = new Array(256);
  let colorIndex = 0;

  for (let brightness = 0; brightness < 256; brightness++) {
    // Find the closest color for this brightness value
    while (colorIndex < colorsByBrightness.length - 1 &&
           Math.abs(colorsByBrightness[colorIndex + 1].brightness - brightness) <
           Math.abs(colorsByBrightness[colorIndex].brightness - brightness)) {
      colorIndex++;
    }
    lookupTable[brightness] = colorsByBrightness[colorIndex].color;
  }

  return lookupTable;
}

/**
 * Replaces all colors in the image with palette colors (optimized)
 * @param {ImageData} imageData - The image data to process
 * @returns {ImageData} The processed image data
 */
function replaceColors(imageData) {
  const lookupTable = getRandomPalette();
  const data = imageData.data;
  const length = data.length;

  // Process pixels in batches for better performance
  for (let i = 0; i < length; i += 4) {
    // Calculate brightness and use direct lookup (O(1) instead of O(256))
    let brightness = Math.floor((data[i] + data[i + 1] + data[i + 2]) / 3);

    // Apply contrast adjustment
    brightness = ((brightness - 128) * contrastValue) + 128;
    brightness = Math.max(0, Math.min(255, Math.floor(brightness)));

    const newColor = lookupTable[brightness];

    data[i] = newColor[0];
    data[i + 1] = newColor[1];
    data[i + 2] = newColor[2];
    // data[i + 3] is alpha, leave unchanged
  }

  return imageData;
}

// ============================================================================
// IMAGE PROCESSING
// ============================================================================

/**
 * Applies pixelation effect to an image (optimized)
 * @param {CanvasRenderingContext2D} context - The canvas context
 * @param {HTMLImageElement} image - The image to pixelate
 */
function pixelateImage(context, image) {
  // Skip pixelation if value is too low to avoid division issues
  if (pixelationValue <= 1) {
    return;
  }

  const canvas = context.canvas;
  const scaledWidth = Math.floor(canvas.width / pixelationValue);
  const scaledHeight = Math.floor(canvas.height / pixelationValue);

  // Disable image smoothing once (setting these repeatedly is wasteful)
  context.imageSmoothingEnabled = false;

  // Draw the scaled-down image
  context.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, scaledWidth, scaledHeight);

  // Scale the image back up to create pixelation effect
  context.drawImage(canvas, 0, 0, scaledWidth, scaledHeight, 0, 0, canvas.width, canvas.height);
}

/**
 * Main image processing function (optimized)
 * @param {string} imgSrc - The image source URL
 */
function processImage(imgSrc) {
  const img = new Image();
  img.onload = function() {
    // Reuse temporary canvas to resize the image (avoid allocation overhead)
    const maxDimension = MAX_CANVAS_DIMENSION;

    tempCanvas.width = (img.width > img.height)
      ? maxDimension
      : Math.floor((img.width / img.height) * maxDimension);
    tempCanvas.height = (img.height > img.width)
      ? maxDimension
      : Math.floor((img.height / img.width) * maxDimension);
    tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);

    // Get main canvas and context
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = tempCanvas.width;
    canvas.height = tempCanvas.height;
    ctx.drawImage(tempCanvas, 0, 0);

    // Apply pixelation
    pixelateImage(ctx, img);

    // Store the pixelated intermediate (before color replacement) for fast shifting
    pixelatedIntermediate = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Apply color replacement
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    imageData = replaceColors(imageData);
    ctx.putImageData(imageData, 0, 0);
  };
  img.src = imgSrc;
}

// ============================================================================
// SPECIAL EFFECTS
// ============================================================================

/**
 * Applies exponentialize effect (blur and re-process)
 */
function exponentializeImage() {
  const applyBtn = document.getElementById('applyBtn');

  // If Apply is not active, automatically activate it
  if (!applyBtn.classList.contains('active')) {
    if (currentImageSrc) {
      processImage(currentImageSrc);
      applyBtn.classList.add('active');
      applyBtn.textContent = 'Reset';
    }
  }

  const canvas = document.getElementById('canvas');
  offScreenCanvas.width = canvas.width;
  offScreenCanvas.height = canvas.height;

  // Draw current image onto off-screen canvas
  offScreenCtx.drawImage(canvas, 0, 0);

  // Reset pixelation and update slider
  pixelationValue = 0;
  document.getElementById('pixelationRange').value = pixelationValue;
  document.getElementById('pixelationValue').value = pixelationValue;

  // Apply blur effect
  offScreenCtx.filter = `blur(${DEFAULT_BLUR_VALUE}px)`;
  offScreenCtx.drawImage(offScreenCanvas, 0, 0);
  offScreenCtx.filter = 'none';

  // Re-process the image
  processImage(currentImageSrc);
  currentImageSrc = offScreenCanvas.toDataURL('image/png');
}

/**
 * Applies shift effect (re-generates colors) - optimized to reuse pixelated intermediate
 */
function shiftImage() {
  if (!pixelatedIntermediate) {
    return; // No intermediate stored yet
  }

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  // Create a copy of the pixelated intermediate to avoid modifying the original
  const imageData = new ImageData(
    new Uint8ClampedArray(pixelatedIntermediate.data),
    pixelatedIntermediate.width,
    pixelatedIntermediate.height
  );

  // Apply new color palette to the intermediate (skip re-pixelation)
  const coloredData = replaceColors(imageData);

  // Update canvas with new colors
  ctx.putImageData(coloredData, 0, 0);
}

/**
 * Toggles the shift effect on/off
 */
function toggleShift() {
  const shiftBtn = document.getElementById('shiftBtn');
  const applyBtn = document.getElementById('applyBtn');

  if (isShifting) {
    clearInterval(shiftInterval);
    isShifting = false;
    shiftBtn.classList.remove('active');
    shiftBtn.textContent = 'Shift';
  } else {
    // If Apply is not active, automatically activate it
    if (!applyBtn.classList.contains('active')) {
      if (currentImageSrc) {
        processImage(currentImageSrc);
        applyBtn.classList.add('active');
        applyBtn.textContent = 'Reset';
      }
    }

    const shiftSpeed = SHIFT_SPEED_OFFSET - document.getElementById('shiftSpeedSlider').value;
    shiftInterval = setInterval(shiftImage, shiftSpeed);
    isShifting = true;
    shiftBtn.classList.add('active');
    shiftBtn.textContent = 'Stop';
  }
}

/**
 * Resets the image to its original uploaded state
 */
function resetImage() {
  if (!originalImageSrc) {
    return;
  }

  // Stop shift if it's running
  if (isShifting) {
    clearInterval(shiftInterval);
    isShifting = false;
    const shiftBtn = document.getElementById('shiftBtn');
    shiftBtn.classList.remove('active');
    shiftBtn.textContent = 'Shift';
  }

  // Reset Apply button state
  const applyBtn = document.getElementById('applyBtn');
  applyBtn.classList.remove('active');
  applyBtn.textContent = 'Apply';

  // Clear the pixelated intermediate since we're resetting
  pixelatedIntermediate = null;

  // Reset to original image and display it
  currentImageSrc = originalImageSrc;
  displayOriginalImage(currentImageSrc);
}

/**
 * Displays the original image without any processing (optimized)
 * @param {string} imgSrc - The image source URL
 */
function displayOriginalImage(imgSrc) {
  const img = new Image();
  img.onload = function() {
    // Reuse temporary canvas to resize the image (avoid allocation overhead)
    const maxDimension = MAX_CANVAS_DIMENSION;

    tempCanvas.width = (img.width > img.height)
      ? maxDimension
      : Math.floor((img.width / img.height) * maxDimension);
    tempCanvas.height = (img.height > img.width)
      ? maxDimension
      : Math.floor((img.height / img.width) * maxDimension);
    tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);

    // Get main canvas and display the unprocessed image
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = tempCanvas.width;
    canvas.height = tempCanvas.height;
    ctx.drawImage(tempCanvas, 0, 0);

    // Clear the pixelated intermediate since we're showing the original
    pixelatedIntermediate = null;
  };
  img.src = imgSrc;
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Image upload handler
document.getElementById('imageUpload').addEventListener('change', function(event) {
  if (event.target.files && event.target.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      originalImageSrc = e.target.result;
      currentImageSrc = originalImageSrc;
      displayOriginalImage(currentImageSrc);
    };
    reader.readAsDataURL(event.target.files[0]);
  }
});

// Pixelation slider
document.getElementById('pixelationRange').addEventListener('input', function(event) {
  document.getElementById('pixelationValue').value = event.target.value;
});

document.getElementById('pixelationRange').addEventListener('change', function(event) {
  pixelationValue = parseInt(event.target.value);

  // If we have a pixelated intermediate, regenerate it with the new pixelation value
  if (pixelatedIntermediate && currentImageSrc) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      // Redraw the resized image
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Get the original image at the current canvas size
      const originalImg = new Image();
      originalImg.onload = function() {
        tempCanvas.width = (originalImg.width > originalImg.height)
          ? MAX_CANVAS_DIMENSION
          : Math.floor((originalImg.width / originalImg.height) * MAX_CANVAS_DIMENSION);
        tempCanvas.height = (originalImg.height > originalImg.width)
          ? MAX_CANVAS_DIMENSION
          : Math.floor((originalImg.height / originalImg.width) * MAX_CANVAS_DIMENSION);
        tempCtx.drawImage(originalImg, 0, 0, tempCanvas.width, tempCanvas.height);

        canvas.width = tempCanvas.width;
        canvas.height = tempCanvas.height;
        ctx.drawImage(tempCanvas, 0, 0);

        // Apply new pixelation
        pixelateImage(ctx, originalImg);

        // Update the pixelated intermediate
        pixelatedIntermediate = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // If shifting is active, immediately apply the shift to show the change
        if (isShifting) {
          shiftImage();
        } else {
          // Otherwise just apply the current colors
          let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          imageData = replaceColors(imageData);
          ctx.putImageData(imageData, 0, 0);
        }
      };
      originalImg.src = currentImageSrc;
    };
    img.src = currentImageSrc;
  }
});

// Saturation slider
document.getElementById('saturationRange').addEventListener('input', function(event) {
  document.getElementById('saturationValue').value = parseFloat(event.target.value).toFixed(2);
});

document.getElementById('saturationRange').addEventListener('change', function(event) {
  saturationValue = parseFloat(event.target.value);

  // If shifting is active or we have a pixelated intermediate, immediately apply the change
  if (pixelatedIntermediate) {
    shiftImage();
  }
});

// Brightness slider
document.getElementById('brightnessRange').addEventListener('input', function(event) {
  document.getElementById('brightnessValue').value = event.target.value;
});

document.getElementById('brightnessRange').addEventListener('change', function(event) {
  brightnessValue = parseInt(event.target.value);

  // If shifting is active or we have a pixelated intermediate, immediately apply the change
  if (pixelatedIntermediate) {
    shiftImage();
  }
});

// Contrast slider
document.getElementById('contrastRange').addEventListener('input', function(event) {
  document.getElementById('contrastValue').value = parseFloat(event.target.value).toFixed(2);
});

document.getElementById('contrastRange').addEventListener('change', function(event) {
  contrastValue = parseFloat(event.target.value);

  // If shifting is active or we have a pixelated intermediate, immediately apply the change
  if (pixelatedIntermediate) {
    shiftImage();
  }
});

// Seed input
document.getElementById('seedInput').addEventListener('change', function(event) {
  currentSeed = parseInt(event.target.value);

  // If shifting is active or we have a pixelated intermediate, immediately apply the change
  if (pixelatedIntermediate) {
    shiftImage();
  }
});

// Randomize seed button
document.getElementById('randomizeSeedBtn').addEventListener('click', function() {
  const newSeed = generateRandomSeed();
  currentSeed = newSeed;
  document.getElementById('seedInput').value = newSeed;

  // If shifting is active or we have a pixelated intermediate, immediately apply the change
  if (pixelatedIntermediate) {
    shiftImage();
  }
});

// Fixed seed checkbox
document.getElementById('useFixedSeed').addEventListener('change', function(event) {
  useFixedSeed = event.target.checked;

  // If shifting is active or we have a pixelated intermediate, immediately apply the change
  if (pixelatedIntermediate) {
    shiftImage();
  }
});

// Apply/Reset button - processes the image or resets it
document.getElementById('applyBtn').addEventListener('click', function() {
  const applyBtn = document.getElementById('applyBtn');

  if (applyBtn.classList.contains('active')) {
    // Reset the image
    resetImage();
    applyBtn.classList.remove('active');
    applyBtn.textContent = 'Apply';
  } else {
    // Apply the effects
    if (currentImageSrc) {
      processImage(currentImageSrc);
      applyBtn.classList.add('active');
      applyBtn.textContent = 'Reset';
    }
  }
});

// Exponentialize button
document.getElementById('exponentializeBtn').addEventListener('click', exponentializeImage);

// Shift button
document.getElementById('shiftBtn').addEventListener('click', toggleShift);

// Shift speed slider
document.getElementById('shiftSpeedSlider').addEventListener('input', function() {
  document.getElementById('shiftSpeedValue').value = this.value;

  if (isShifting) {
    clearInterval(shiftInterval);
    const shiftSpeed = SHIFT_SPEED_OFFSET - document.getElementById('shiftSpeedSlider').value;
    shiftInterval = setInterval(shiftImage, shiftSpeed);
  }
});

// Download button
document.getElementById('downloadBtn').addEventListener('click', function() {
  const canvas = document.getElementById('canvas');
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = 'i-love-this-image.png';
  link.click();
});
