// ============================================================================
// IMAGE PROCESSING
// - createImageBitmap for faster decode/resize
// - Buffer reuse (minimize getImageData/putImageData calls)
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
 * Process image
 */
async function processImage(imgSrc) {
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

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    // Pixelation
    pixelateImage(ctx, bitmap);
    bitmap.close && bitmap.close();

    // Store intermediate
    pixelatedIntermediate = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Color replace with LUT
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    imageData = replaceColors(imageData);
    ctx.putImageData(imageData, 0, 0);

    refreshImageDownloadUrl();
  } catch (error) {
    console.error('Image processing failed:', error);
    throw error;
  }
}

/**
 * Display original image with createImageBitmap
 */
async function displayOriginalImage(imgSrc) {
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
    console.error('Image display failed:', error);
    throw error;
  }
}

/**
 * Shift colors
 */
function shiftImage() {
  if (!pixelatedIntermediate) return;

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  // Reuse buffer to avoid allocation
  const imageData = getReusableBuffer(
    pixelatedIntermediate.width,
    pixelatedIntermediate.height
  );

  // Copy data
  imageData.data.set(pixelatedIntermediate.data);

  // Apply new palette
  replaceColors(imageData);

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

function refreshImageDownloadUrl() {
  const canvas = document.getElementById('canvas');
  if (!canvas || !canvas.width) return;

  canvas.toBlob((blob) => {
    if (!blob) return;
    if (imageDownloadUrl) URL.revokeObjectURL(imageDownloadUrl);
    imageDownloadUrl = URL.createObjectURL(blob);
  }, 'image/png');
}
