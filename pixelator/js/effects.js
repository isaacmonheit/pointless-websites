// ============================================================================
// SPECIAL EFFECTS
// ============================================================================

/**
 * Exponentialize: blur then re-process
 */
async function exponentializeImage() {
  const applyBtn = document.getElementById('applyBtn');

  if (!applyBtn.classList.contains('active')) {
    if (currentImageSrc) {
      await processImage(currentImageSrc);
      applyBtn.classList.add('active');
      applyBtn.textContent = 'Reset';
    }
  }

  const canvas = document.getElementById('canvas');
  offScreenCanvas.width = canvas.width;
  offScreenCanvas.height = canvas.height;

  // Draw current visible canvas to offscreen
  offScreenCtx.clearRect(0, 0, offScreenCanvas.width, offScreenCanvas.height);
  offScreenCtx.drawImage(canvas, 0, 0);

  // Reset pixelation and slider
  pixelationValue = 0;
  document.getElementById('pixelationRange').value = pixelationValue;
  document.getElementById('pixelationValue').value = pixelationValue;

  // Blur then create a blob URL and re-process from that
  offScreenCtx.filter = `blur(${DEFAULT_BLUR_VALUE}px)`;
  offScreenCtx.drawImage(offScreenCanvas, 0, 0);
  offScreenCtx.filter = 'none';

  offScreenCanvas.toBlob(async (blob) => {
    if (!blob) return;
    // Replace current image source with a blob URL (revoke old if it was a blob URL)
    if (currentImageSrc && currentImageSrc.startsWith('blob:')) {
      URL.revokeObjectURL(currentImageSrc);
    }
    const url = URL.createObjectURL(blob);
    currentImageSrc = url;
    await processImage(currentImageSrc);
  }, 'image/png');
}

/**
 * Toggle shift loop
 */
async function toggleShift() {
  const shiftBtn = document.getElementById('shiftBtn');
  const applyBtn = document.getElementById('applyBtn');

  if (isShifting) {
    clearInterval(shiftInterval);
    isShifting = false;
    shiftBtn.classList.remove('active');
    shiftBtn.textContent = 'Shift';

    // Clean up previous frames when stopping shift
    if (typeof cleanupIntermediateFrames === 'function') {
      cleanupIntermediateFrames();
    }
  } else {
    if (!applyBtn.classList.contains('active')) {
      if (currentImageSrc) {
        await processImage(currentImageSrc);
        applyBtn.classList.add('active');
        applyBtn.textContent = 'Reset';
      }
    }

    const shiftSpeed =
      SHIFT_SPEED_OFFSET - document.getElementById('shiftSpeedSlider').value;
    shiftInterval = setInterval(shiftImage, shiftSpeed);
    isShifting = true;
    shiftBtn.classList.add('active');
    shiftBtn.textContent = 'Stop';
  }
}

/**
 * Reset to original
 */
async function resetImage() {
  if (!originalImageSrc) return;

  stopAllActivity();

  const applyBtn = document.getElementById('applyBtn');
  applyBtn.classList.remove('active');
  applyBtn.textContent = 'Apply';

  pixelatedIntermediate = null;

  currentImageSrc = originalImageSrc;

  await displayOriginalImage(currentImageSrc);
}
