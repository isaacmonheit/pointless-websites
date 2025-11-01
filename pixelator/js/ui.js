// ============================================================================
// EVENT LISTENERS
// ============================================================================

document.getElementById('imageUpload').addEventListener('change', async function (event) {
  if (!(event.target.files && event.target.files[0])) return;

  stopAllActivity();

  let file = event.target.files[0];
  const reader = new FileReader();

  isVideoMode = file.type.startsWith('video/');

  if (isVideoMode && needsConversion(file)) {
    if (
      !confirm(
        'This video type needs to be converted to .mp4 or .webm before pixelatifying!\n\nThe in-browser conversion code may be slow; converting yourself first may be faster. Continue and convert here?'
      )
    ) {
      event.target.value = '';
      return;
    }

    const conversionOverlay = document.getElementById('conversionOverlay');
    const conversionText = document.getElementById('conversionText');
    const conversionBar = document.getElementById('conversionBar');
    const conversionPercent = document.getElementById('conversionPercent');

    try {
      conversionOverlay.style.display = 'flex';

      const convertedBlob = await convertVideoToWebM(file, (message, percent) => {
        conversionText.textContent = message;
        conversionBar.style.width = percent + '%';
        conversionPercent.textContent = Math.round(percent) + '%';
      });

      file = new File(
        [convertedBlob],
        file.name.replace(/\.[^.]+$/, '.webm'),
        { type: 'video/webm' }
      );

      setTimeout(() => {
        conversionOverlay.style.display = 'none';
      }, 1500);
    } catch (error) {
      console.error('Conversion error:', error);
      conversionOverlay.style.display = 'none';
      alert(
        'Failed to convert video: ' +
          error.message +
          '\n\nPlease try a different video format or convert it manually.'
      );
      event.target.value = '';
      return;
    }
  }

  reader.onload = function (e) {
    const effectsSection = document.getElementById('effectsSection');
    const downloadSection = document.getElementById('downloadSection');
    const imageButtons = document.getElementById('imageButtons');
    const videoButtons = document.getElementById('videoButtons');
    const shiftSpeedControl = document.getElementById('shiftSpeedControl');
    const canvasEl = document.getElementById('canvas');
    const videoPlayer = document.getElementById('videoPlayer');

    if (isVideoMode) {
      // Video mode
      currentVideoSrc = e.target.result;
      videoFrames = [];
      processedVideoBlob = null;

      // Reset old video URLs
      if (videoDownloadUrl) {
        URL.revokeObjectURL(videoDownloadUrl);
        videoDownloadUrl = null;
      }
      if (videoPlayer.dataset.objUrl) {
        URL.revokeObjectURL(videoPlayer.dataset.objUrl);
        delete videoPlayer.dataset.objUrl;
      }
      videoPlayer.removeAttribute('src');
      videoPlayer.load();

      effectsSection.style.display = 'flex';
      downloadSection.style.display = 'block';

      imageButtons.style.display = 'none';
      videoButtons.style.display = 'flex';
      shiftSpeedControl.style.display = 'none';
      document.getElementById('downloadBtn').textContent = 'Download Video';

      canvasEl.style.display = 'none';
      videoPlayer.style.display = 'none';
    } else {
      // Image mode
      originalImageSrc = e.target.result;
      currentImageSrc = originalImageSrc;

      effectsSection.style.display = 'flex';
      downloadSection.style.display = 'block';

      imageButtons.style.display = 'flex';
      videoButtons.style.display = 'none';
      shiftSpeedControl.style.display = 'flex';
      document.getElementById('downloadBtn').textContent = 'Download Image';

      canvasEl.style.display = 'block';
      videoPlayer.style.display = 'none';

      // Use optimized version if available
      if (typeof displayOriginalImageOptimized !== 'undefined') {
        displayOriginalImageOptimized(currentImageSrc);
      } else {
        displayOriginalImage(currentImageSrc);
      }
    }
  };

  reader.onerror = function () {
    alert('Failed to read file. Please try again.');
  };

  reader.readAsDataURL(file);
});

// Pixelation slider
document.getElementById('pixelationRange').addEventListener('input', function (event) {
  document.getElementById('pixelationValue').value = event.target.value;
});

document.getElementById('pixelationRange').addEventListener('change', function (event) {
  pixelationValue = parseInt(event.target.value, 10);

  if (pixelatedIntermediate && currentImageSrc) {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const originalImg = new Image();
    originalImg.onload = function () {
      tempCanvas.width =
        originalImg.width >= originalImg.height
          ? MAX_CANVAS_DIMENSION
          : Math.floor((originalImg.width / originalImg.height) * MAX_CANVAS_DIMENSION);
      tempCanvas.height =
        originalImg.height >= originalImg.width
          ? MAX_CANVAS_DIMENSION
          : Math.floor((originalImg.height / originalImg.width) * MAX_CANVAS_DIMENSION);

      tempCtx.drawImage(originalImg, 0, 0, tempCanvas.width, tempCanvas.height);

      canvas.width = tempCanvas.width;
      canvas.height = tempCanvas.height;
      ctx.drawImage(tempCanvas, 0, 0);

      pixelateImage(ctx);

      pixelatedIntermediate = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (isShifting) {
        shiftImage();
      } else {
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        imageData = replaceColors(imageData);
        ctx.putImageData(imageData, 0, 0);
        refreshImageDownloadUrl();
      }
    };
    originalImg.src = currentImageSrc;
  }
});

// Saturation slider
document
  .getElementById('saturationRange')
  .addEventListener('input', function (event) {
    document.getElementById('saturationValue').value = parseFloat(
      event.target.value
    ).toFixed(2);
  });

document
  .getElementById('saturationRange')
  .addEventListener('change', function (event) {
    saturationValue = parseFloat(event.target.value);
    if (typeof invalidateLUTCache !== 'undefined') invalidateLUTCache();
    if (pixelatedIntermediate) shiftImage();
  });

// Brightness slider
document
  .getElementById('brightnessRange')
  .addEventListener('input', function (event) {
    document.getElementById('brightnessValue').value = event.target.value;
  });

document
  .getElementById('brightnessRange')
  .addEventListener('change', function (event) {
    brightnessValue = parseInt(event.target.value, 10);
    if (typeof invalidateLUTCache !== 'undefined') invalidateLUTCache();
    if (pixelatedIntermediate) shiftImage();
  });

// Contrast slider
document
  .getElementById('contrastRange')
  .addEventListener('input', function (event) {
    document.getElementById('contrastValue').value = parseFloat(
      event.target.value
    ).toFixed(2);
  });

document
  .getElementById('contrastRange')
  .addEventListener('change', function (event) {
    contrastValue = parseFloat(event.target.value);
    if (typeof invalidateLUTCache !== 'undefined') invalidateLUTCache();
    if (pixelatedIntermediate) shiftImage();
  });

// Seed input
document.getElementById('seedInput').addEventListener('change', function (event) {
  currentSeed = parseInt(event.target.value, 10);
  if (typeof invalidateLUTCache !== 'undefined') invalidateLUTCache();
  if (pixelatedIntermediate) shiftImage();
});

// Randomize seed button
document.getElementById('randomizeSeedBtn').addEventListener('click', function () {
  const newSeed = generateRandomSeed();
  currentSeed = newSeed;
  document.getElementById('seedInput').value = newSeed;
  if (typeof invalidateLUTCache !== 'undefined') invalidateLUTCache();
  if (pixelatedIntermediate) shiftImage();
});

// Fixed seed checkbox
document.getElementById('useFixedSeed').addEventListener('change', function (event) {
  useFixedSeed = event.target.checked;
  if (pixelatedIntermediate) shiftImage();
});

// Apply/Reset button
document.getElementById('applyBtn').addEventListener('click', async function () {
  const applyBtn = document.getElementById('applyBtn');

  if (applyBtn.classList.contains('active')) {
    await resetImage();
    applyBtn.classList.remove('active');
    applyBtn.textContent = 'Apply';
  } else {
    if (currentImageSrc) {
      // Use optimized version if available
      if (typeof processImageOptimized !== 'undefined') {
        await processImageOptimized(currentImageSrc);
      } else {
        processImage(currentImageSrc);
      }
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
document.getElementById('shiftSpeedSlider').addEventListener('input', function () {
  document.getElementById('shiftSpeedValue').value = this.value;

  if (isShifting) {
    clearInterval(shiftInterval);
    const shiftSpeed =
      SHIFT_SPEED_OFFSET - document.getElementById('shiftSpeedSlider').value;
    shiftInterval = setInterval(shiftImage, shiftSpeed);
  }
});

// Preview first 15 frames button
document.getElementById('previewFramesBtn').addEventListener('click', async function () {
  if (!currentVideoSrc) return;

  const previewBtn = document.getElementById('previewFramesBtn');

  if (isPreviewing) {
    clearInterval(previewInterval);
    isPreviewing = false;
    previewBtn.classList.remove('active');
    previewBtn.textContent = 'Preview First 15 Frames';
    document.getElementById('canvas').style.display = 'none';
    return;
  }

  previewBtn.disabled = true;
  previewBtn.textContent = 'Extracting frames...';

  try {
    if (videoFrames.length === 0) {
      videoFrames = await extractVideoFrames(currentVideoSrc, 15, (progress) => {
        previewBtn.textContent = `Extracting: ${Math.floor(progress)}%`;
      });
    }

    if (videoFrames.length === 0) {
      alert('Failed to extract video frames');
      previewBtn.disabled = false;
      previewBtn.textContent = 'Preview First 15 Frames';
      return;
    }

    document.getElementById('canvas').style.display = 'block';
    document.getElementById('videoPlayer').style.display = 'none';

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    canvas.width = videoFrames[0].width;
    canvas.height = videoFrames[0].height;

    isPreviewing = true;
    previewBtn.classList.add('active');
    previewBtn.textContent = 'Stop Preview';
    previewBtn.disabled = false;

    let frameIndex = 0;
    let frameSeed = currentSeed;

    previewInterval = setInterval(() => {
      const frame = videoFrames[frameIndex];

      frameSeed = generateDeterministicSeed(frameSeed, frame.imageData);

      const processedFrame = processVideoFrame(
        frame.imageData,
        frame.width,
        frame.height,
        frameSeed
      );
      ctx.putImageData(processedFrame, 0, 0);

      frameIndex = (frameIndex + 1) % videoFrames.length;
      if (frameIndex === 0) frameSeed = currentSeed;
    }, 1000 / 30);
  } catch (error) {
    console.error('Preview error:', error);
    alert('Failed to preview video: ' + error.message);
    previewBtn.disabled = false;
    previewBtn.textContent = 'Preview First 15 Frames';
  }
});

// Process video button (now muxes original audio back in)
document.getElementById('processVideoBtn').addEventListener('click', async function () {
  if (!currentVideoSrc) return;

  stopAllActivity();

  const processBtn = document.getElementById('processVideoBtn');
  const progressDiv = document.getElementById('videoProgress');
  const progressText = document.getElementById('progressText');
  const progressBar = document.getElementById('progressBar');

  processBtn.disabled = true;
  progressDiv.style.display = 'block';

  document.getElementById('canvas').style.display = 'block';
  document.getElementById('videoPlayer').style.display = 'none';

  try {
    progressText.textContent = 'Extracting frames: 0%';
    const allFrames = await extractVideoFrames(currentVideoSrc, 0, (progress) => {
      progressText.textContent = `Extracting frames: ${Math.floor(progress)}%`;
      progressBar.style.width = progress / 2 + '%';
    });

    if (allFrames.length === 0) {
      alert('Failed to extract video frames');
      processBtn.disabled = false;
      progressDiv.style.display = 'none';
      return;
    }

    progressText.textContent = 'Processing video: 0%';
    // Use optimized version if available
    if (typeof processFullVideoOptimized !== 'undefined') {
      processedVideoBlob = await processFullVideoOptimized(allFrames, (progress) => {
        progressText.textContent = `Processing video: ${Math.floor(progress)}%`;
        progressBar.style.width = 50 + progress / 2 + '%';
      });
    } else {
      processedVideoBlob = await processFullVideo(allFrames, (progress) => {
        progressText.textContent = `Processing video: ${Math.floor(progress)}%`;
        progressBar.style.width = 50 + progress / 2 + '%';
      });
    }

    // ---- NEW: Try to restore the original audio track via ffmpeg.wasm ----
    try {
      const muxed = await muxOriginalAudioIntoProcessed(processedVideoBlob, currentVideoSrc);
      processedVideoBlob = muxed;
    } catch (e) {
      console.warn('Audio mux failed; delivering video-only output. Reason:', e.message || e);
    }

    const videoPlayer = document.getElementById('videoPlayer');
    if (!processedVideoBlob || !processedVideoBlob.size) {
      console.error('No processed video blob to play.');
      processBtn.disabled = false;
      progressDiv.style.display = 'none';
      return;
    }

    if (videoPlayer.dataset.objUrl) {
      URL.revokeObjectURL(videoPlayer.dataset.objUrl);
    }
    const objUrl = URL.createObjectURL(processedVideoBlob);
    videoPlayer.dataset.objUrl = objUrl;
    videoPlayer.src = objUrl;
    videoPlayer.style.display = 'block';
    document.getElementById('canvas').style.display = 'none';

    // Precompute download URL (reuse same objUrl)
    if (videoDownloadUrl) URL.revokeObjectURL(videoDownloadUrl);
    videoDownloadUrl = objUrl;

    progressText.textContent = 'Processing complete!';
    progressBar.style.width = '100%';

    setTimeout(() => {
      progressDiv.style.display = 'none';
    }, 2000);

    processBtn.disabled = false;
  } catch (error) {
    console.error('Processing error:', error);
    alert('Failed to process video: ' + error.message);
    processBtn.disabled = false;
    progressDiv.style.display = 'none';
  }
});

const videoPlayerEl = document.getElementById('videoPlayer');
videoPlayerEl.addEventListener('error', () => {
  const err = videoPlayerEl.error;
  if (err) console.warn('Video element error:', err.code, err.message);
});

// Download button
document.getElementById('downloadBtn').addEventListener('click', () => {
  stopAllActivity();

  if (isVideoMode) {
    if (videoDownloadUrl) {
      const a = document.createElement('a');
      a.href = videoDownloadUrl;
      a.download = 'pixelated.webm';
      document.body.appendChild(a);
      requestAnimationFrame(() => {
        a.click();
        a.remove();
      });
      return;
    }
    if (processedVideoBlob) {
      downloadBlob(processedVideoBlob, 'pixelated.webm');
      return;
    }
    alert('Process the video first.');
  } else {
    if (imageDownloadUrl) {
      const a = document.createElement('a');
      a.href = imageDownloadUrl;
      a.download = 'pixelated.png';
      document.body.appendChild(a);
      requestAnimationFrame(() => {
        a.click();
        a.remove();
      });
      return;
    }
    const canvas = document.getElementById('canvas');
    if (!canvas || !canvas.width) return;
    canvas.toBlob((blob) => downloadBlob(blob, 'pixelated.png'), 'image/png');
  }
});
