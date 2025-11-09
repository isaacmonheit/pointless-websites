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
 * Setup canvas with bitmap
 */
async function setupCanvasWithBitmap(imgSrc) {
  const blob = await fetch(imgSrc).then(r => r.blob());
  const bitmap = await loadImageFast(blob);
  const { width, height } = calculateTargetDimensions(bitmap.width, bitmap.height);

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(bitmap, 0, 0, width, height);

  return { bitmap, ctx, canvas };
}

/**
 * Process image
 */
async function processImage(imgSrc) {
  try {
    const { bitmap, ctx, canvas } = await setupCanvasWithBitmap(imgSrc);

    pixelateImage(ctx, bitmap);
    bitmap.close && bitmap.close();

    pixelatedIntermediate = ctx.getImageData(0, 0, canvas.width, canvas.height);

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
 * Display original image
 */
async function displayOriginalImage(imgSrc) {
  try {
    const { bitmap } = await setupCanvasWithBitmap(imgSrc);
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
