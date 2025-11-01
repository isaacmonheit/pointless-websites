// ============================================================================
// OPTIMIZED IMAGE PROCESSING
// - createImageBitmap for faster decode/resize
// - Buffer reuse (minimize getImageData/putImageData calls)
// - WebGL-first with CPU fallback
// ============================================================================

// Reusable ImageData buffer
let reusableImageData = null;

/**
 * Fast image loading with createImageBitmap
 */
async function loadImageFast(blob) {
  try {
    // createImageBitmap is much faster than Image + canvas
    const bitmap = await createImageBitmap(blob);
    return bitmap;
  } catch (e) {
    // Fallback to traditional method
    console.warn('createImageBitmap failed, using fallback:', e);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }
}

/**
 * Get or create reusable ImageData buffer
 */
function getReusableBuffer(width, height) {
  if (!reusableImageData ||
      reusableImageData.width !== width ||
      reusableImageData.height !== height) {
    reusableImageData = new ImageData(width, height);
  }
  return reusableImageData;
}

/**
 * OPTIMIZED: Process image with WebGL (GPU) or fallback to CPU
 */
async function processImageOptimized(imgSrc) {
  try {
    // Convert data URL to blob for createImageBitmap
    const blob = await fetch(imgSrc).then(r => r.blob());
    const bitmap = await loadImageFast(blob);

    // Calculate target dimensions
    const maxDimension = MAX_CANVAS_DIMENSION;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const targetWidth = Math.floor(bitmap.width * scale);
    const targetHeight = Math.floor(bitmap.height * scale);

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Try WebGL first (10-100x faster)
    const renderer = getWebGLRenderer(canvas);
    const gpuSuccess = renderer.render(bitmap, targetWidth, targetHeight);

    if (gpuSuccess) {
      // GPU rendering successful
      bitmap.close && bitmap.close(); // Free bitmap memory

      // For shifting, we need the pixelated intermediate
      // Read it back from GPU (only once, not per-pixel)
      if (pixelationValue > 0) {
        pixelatedIntermediate = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } else {
        pixelatedIntermediate = null;
      }

      refreshImageDownloadUrl();
      return;
    }

    // Fallback to CPU
    console.log('Using CPU fallback for image processing');
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close && bitmap.close();

    // CPU pixelation
    pixelateImage(ctx);

    // Store intermediate
    pixelatedIntermediate = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Color replace with optimized LUT
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    imageData = replaceColorsOptimized(imageData);
    ctx.putImageData(imageData, 0, 0);

    refreshImageDownloadUrl();
  } catch (error) {
    console.error('Optimized image processing failed:', error);
    // Fall back to original method
    processImage(imgSrc);
  }
}

/**
 * OPTIMIZED: Display original image with createImageBitmap
 */
async function displayOriginalImageOptimized(imgSrc) {
  try {
    const blob = await fetch(imgSrc).then(r => r.blob());
    const bitmap = await loadImageFast(blob);

    const maxDimension = MAX_CANVAS_DIMENSION;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const targetWidth = Math.floor(bitmap.width * scale);
    const targetHeight = Math.floor(bitmap.height * scale);

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close && bitmap.close();

    pixelatedIntermediate = null;
    refreshImageDownloadUrl();
  } catch (error) {
    console.error('Optimized image display failed:', error);
    displayOriginalImage(imgSrc);
  }
}

/**
 * OPTIMIZED: Shift with WebGL or CPU
 */
function shiftImageOptimized() {
  if (!pixelatedIntermediate) return;

  const canvas = document.getElementById('canvas');

  // Try GPU path first
  const renderer = getWebGLRenderer(canvas);
  const gpuSuccess = renderer.renderImageData(pixelatedIntermediate);

  if (gpuSuccess) {
    refreshImageDownloadUrl();
    return;
  }

  // CPU fallback
  const ctx = canvas.getContext('2d');

  // Reuse buffer to avoid allocation
  const imageData = getReusableBuffer(
    pixelatedIntermediate.width,
    pixelatedIntermediate.height
  );

  // Copy data
  imageData.data.set(pixelatedIntermediate.data);

  // Apply new palette (optimized)
  replaceColorsOptimized(imageData);

  // Single putImageData (not multiple)
  ctx.putImageData(imageData, 0, 0);
  refreshImageDownloadUrl();
}

/**
 * Pixelation effect (CPU fallback)
 */
function pixelateImage(context) {
  if (pixelationValue <= 1) return;

  const canvas = context.canvas;
  const scaledWidth = Math.floor(canvas.width / pixelationValue);
  const scaledHeight = Math.floor(canvas.height / pixelationValue);

  context.imageSmoothingEnabled = false;

  context.drawImage(
    canvas,
    0, 0, canvas.width, canvas.height,
    0, 0, scaledWidth, scaledHeight
  );

  context.drawImage(
    canvas,
    0, 0, scaledWidth, scaledHeight,
    0, 0, canvas.width, canvas.height
  );
}

/**
 * CPU fallback for original processImage
 */
function processImage(imgSrc) {
  const img = new Image();
  img.onload = function () {
    const maxDimension = MAX_CANVAS_DIMENSION;

    tempCanvas.width =
      img.width >= img.height
        ? maxDimension
        : Math.floor((img.width / img.height) * maxDimension);
    tempCanvas.height =
      img.height >= img.width
        ? maxDimension
        : Math.floor((img.height / img.width) * maxDimension);
    tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = tempCanvas.width;
    canvas.height = tempCanvas.height;
    ctx.drawImage(tempCanvas, 0, 0);

    pixelateImage(ctx);
    pixelatedIntermediate = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    imageData = replaceColorsOptimized(imageData);
    ctx.putImageData(imageData, 0, 0);

    refreshImageDownloadUrl();
  };
  img.src = imgSrc;
}

/**
 * CPU fallback for displayOriginalImage
 */
function displayOriginalImage(imgSrc) {
  const img = new Image();
  img.onload = function () {
    const maxDimension = MAX_CANVAS_DIMENSION;

    tempCanvas.width =
      img.width >= img.height
        ? maxDimension
        : Math.floor((img.width / img.height) * maxDimension);
    tempCanvas.height =
      img.height >= img.width
        ? maxDimension
        : Math.floor((img.height / img.width) * maxDimension);
    tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = tempCanvas.width;
    canvas.height = tempCanvas.height;
    ctx.drawImage(tempCanvas, 0, 0);

    pixelatedIntermediate = null;
    refreshImageDownloadUrl();
  };
  img.src = imgSrc;
}

/**
 * Shift image (backwards compatible)
 */
function shiftImage() {
  shiftImageOptimized();
}

function refreshImageDownloadUrl() {
  const canvas = document.getElementById('canvas');
  if (!canvas || !canvas.width) return;

  canvas.toBlob((blob) => {
    if (!blob) return;
    if (imageDownloadUrl) URL.revokeObjectURL(imageDownloadUrl);
    imageDownloadUrl = URL.createObjectURL(blob);
  }, 'image/png');
}
