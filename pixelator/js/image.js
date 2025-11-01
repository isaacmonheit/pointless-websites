// ============================================================================
// IMAGE PROCESSING
// ============================================================================

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
 * Main image processing
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

    // Pixelate
    pixelateImage(ctx, img);

    // Store intermediate (pre-color replace)
    pixelatedIntermediate = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Color replace
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    imageData = replaceColors(imageData);
    ctx.putImageData(imageData, 0, 0);

    // Prebuild image download URL
    refreshImageDownloadUrl();
  };
  img.src = imgSrc;
}

/**
 * Display original (no processing)
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

function refreshImageDownloadUrl() {
  const canvas = document.getElementById('canvas');
  if (!canvas || !canvas.width) return;

  canvas.toBlob((blob) => {
    if (!blob) return;
    if (imageDownloadUrl) URL.revokeObjectURL(imageDownloadUrl);
    imageDownloadUrl = URL.createObjectURL(blob);
  }, 'image/png');
}
