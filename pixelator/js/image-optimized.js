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

    // Use same scaling logic as videos for consistency
    const maxDim = MAX_CANVAS_DIMENSION;
    const scale = Math.min(maxDim / bitmap.width, maxDim / bitmap.height);
    const targetWidth = Math.round(bitmap.width * scale / 2) * 2;
    const targetHeight = Math.round(bitmap.height * scale / 2) * 2;

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

    // CPU pixelation
    pixelateImage(ctx, bitmap);
    bitmap.close && bitmap.close();

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

    // Use same scaling logic as videos for consistency
    const maxDim = MAX_CANVAS_DIMENSION;
    const scale = Math.min(maxDim / bitmap.width, maxDim / bitmap.height);
    const targetWidth = Math.round(bitmap.width * scale / 2) * 2;
    const targetHeight = Math.round(bitmap.height * scale / 2) * 2;

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
 * Pixelation effect (matches original algorithm)
 */
function pixelateImage(context, image) {
  if (pixelationValue <= 1) return;

  const scaledWidth = image.width / pixelationValue;
  const scaledHeight = image.height / pixelationValue;

  // Draw the scaled-down image
  context.drawImage(image, 0, 0, scaledWidth, scaledHeight);

  // Now scale the image back up to its original size, causing pixelation
  context.mozImageSmoothingEnabled = false;
  context.webkitImageSmoothingEnabled = false;
  context.imageSmoothingEnabled = false;
  context.drawImage(context.canvas, 0, 0, scaledWidth, scaledHeight, 0, 0, context.canvas.width, context.canvas.height);
}

/**
 * CPU fallback for original processImage
 */
function processImage(imgSrc) {
  const img = new Image();
  img.onload = function () {
    // Use same scaling logic as videos for consistency
    const maxDim = MAX_CANVAS_DIMENSION;
    const scale = Math.min(maxDim / img.width, maxDim / img.height);
    const targetWidth = Math.round(img.width * scale / 2) * 2;
    const targetHeight = Math.round(img.height * scale / 2) * 2;

    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    tempCtx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.drawImage(tempCanvas, 0, 0);

    pixelateImage(ctx, img);
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
    // Use same scaling logic as videos for consistency
    const maxDim = MAX_CANVAS_DIMENSION;
    const scale = Math.min(maxDim / img.width, maxDim / img.height);
    const targetWidth = Math.round(img.width * scale / 2) * 2;
    const targetHeight = Math.round(img.height * scale / 2) * 2;

    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    tempCtx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = targetWidth;
    canvas.height = targetHeight;
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
