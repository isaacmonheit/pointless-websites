function resetButton(buttonId, defaultText) {
  const btn = document.getElementById(buttonId);
  if (btn) {
    btn.classList.remove('active');
    btn.textContent = defaultText;
  }
}

/**
 * Toggle button active state
 */
function toggleButton(buttonId, activeText, inactiveText) {
  const btn = document.getElementById(buttonId);
  if (!btn) return false;

  const isActive = btn.classList.contains('active');
  if (isActive) {
    btn.classList.remove('active');
    btn.textContent = inactiveText;
  } else {
    btn.classList.add('active');
    btn.textContent = activeText;
  }
  return !isActive;
}

/**
 * Cleanup video URLs
 */
function cleanupVideoUrls() {
  if (videoDownloadUrl) {
    URL.revokeObjectURL(videoDownloadUrl);
    videoDownloadUrl = null;
  }

  const videoPlayer = document.getElementById('videoPlayer');
  if (videoPlayer?.dataset.objUrl) {
    URL.revokeObjectURL(videoPlayer.dataset.objUrl);
    delete videoPlayer.dataset.objUrl;
  }

  if (currentVideoSrc?.startsWith('blob:')) {
    URL.revokeObjectURL(currentVideoSrc);
  }
}

async function handleFileUpload(file, clearFileInput = null) {
  if (!file) return;

  // Check file size and warn if over 800 MB
  const fileSizeMB = file.size / 1024 / 1024;
  const SIZE_WARNING_THRESHOLD_MB = 800;

  if (fileSizeMB > SIZE_WARNING_THRESHOLD_MB) {
    const proceed = confirm(
      `WARNING: Large file detected!\n\n` +
      `File size: ${fileSizeMB.toFixed(2)} MB\n\n` +
      `Processing files larger than ${SIZE_WARNING_THRESHOLD_MB} MB may crash your browser tab due to memory limits.\n\n` +
      `Do you want to proceed anyway?`
    );

    if (!proceed) {
      clearFileInput?.();
      return;
    }
  }

  stopAllActivity();

  isVideoMode = file.type.startsWith('video/');
  let wasConverted = false;

  if (isVideoMode && needsConversion(file)) {
    if (!confirm(
        'This video type needs to be converted to .mp4 or .webm before pixelating!\n\n' +
        'The page can automatically convert it in-browser, but it will be SLOW!\n\n' +
        'Continue?'
        )) {
      clearFileInput?.();
      return;
    }

    const conversionOverlay = document.getElementById('conversionOverlay');
    const conversionText = document.getElementById('conversionText');
    const conversionPercent = document.getElementById('conversionPercent');

    try {
      conversionOverlay.style.display = 'flex';

      const convertedBlob = await convertVideoToWebM(file, (message, percent) => {
        conversionText.textContent = message;
        conversionPercent.textContent = Math.round(percent) + '%';
      });

      file = convertedBlob;
      wasConverted = true;

      setTimeout(() => {
        conversionOverlay.style.display = 'none';
      }, 1500);
    } catch (error) {
      console.error('Conversion error:', error);
      conversionOverlay.style.display = 'none';
      alert('Failed to convert video: ' + error.message + '\n\nPlease try a different video format or convert it manually.');
      clearFileInput?.();
      return;
    }
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const effectsSection = document.getElementById('effectsSection');
    const downloadSection = document.getElementById('downloadSection');
    const imageButtons = document.getElementById('imageButtons');
    const videoButtons = document.getElementById('videoButtons');
    const shiftSpeedControl = document.getElementById('shiftSpeedControl');
    const canvasEl = document.getElementById('canvas');
    const videoPlayer = document.getElementById('videoPlayer');
    const emptyState = document.querySelector('.empty-state');

    resetButton('applyBtn', 'Apply');
    resetButton('shiftBtn', 'Shift');

    if (emptyState) emptyState.style.display = 'none';

    if (isVideoMode) {
      videoFrames = [];
      processedVideoBlob = null;

      cleanupVideoUrls();

      // Use blob URL for converted videos to save memory
      currentVideoSrc = wasConverted ? URL.createObjectURL(file) : e.target.result;

      effectsSection.style.display = 'flex';
      downloadSection.style.display = 'block';

      imageButtons.style.display = 'none';
      videoButtons.style.display = 'flex';
      shiftSpeedControl.style.display = 'none';
      document.getElementById('downloadBtn').textContent = 'Download Video';

      // Display the uploaded video immediately
      videoPlayer.src = currentVideoSrc;
      videoPlayer.load();

      // Scale video player to match processed video dimensions
      videoPlayer.addEventListener('loadedmetadata', function scaleVideo() {
        const maxDim = MAX_CANVAS_DIMENSION;
        const scale = Math.min(maxDim / videoPlayer.videoWidth, maxDim / videoPlayer.videoHeight);
        const targetWidth = Math.round(videoPlayer.videoWidth * scale / 2) * 2;
        const targetHeight = Math.round(videoPlayer.videoHeight * scale / 2) * 2;

        videoPlayer.style.width = targetWidth + 'px';
        videoPlayer.style.height = targetHeight + 'px';

        // Remove listener after first use
        videoPlayer.removeEventListener('loadedmetadata', scaleVideo);
      });

      canvasEl.style.display = 'none';
      videoPlayer.style.display = 'block';
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

      displayOriginalImage(currentImageSrc);
    }
  };

  reader.onerror = function () {
    alert('Failed to read file. Please try again.');
  };

  reader.readAsDataURL(file);
}

document.getElementById('imageUpload').addEventListener('change', async function (event) {
  if (!(event.target.files && event.target.files[0])) return;
  await handleFileUpload(event.target.files[0], () => {
    event.target.value = '';
  });
});

// Drag and drop events
const canvasContainer = document.getElementById('canvasContainer');

canvasContainer.addEventListener('dragover', function (event) {
  event.preventDefault();
  event.stopPropagation();
  canvasContainer.style.outline = '3px dashed var(--primary-color)';
  canvasContainer.style.outlineOffset = '-10px';
  canvasContainer.style.backgroundColor = 'rgba(79, 70, 229, 0.05)';
});

canvasContainer.addEventListener('dragleave', function (event) {
  event.preventDefault();
  event.stopPropagation();
  // Only remove styling if we're leaving the container itself, not a child
  if (event.target === canvasContainer) {
    canvasContainer.style.outline = '';
    canvasContainer.style.outlineOffset = '';
    canvasContainer.style.backgroundColor = '';
  }
});

canvasContainer.addEventListener('drop', async function (event) {
  event.preventDefault();
  event.stopPropagation();

  // Remove drag styling
  canvasContainer.style.outline = '';
  canvasContainer.style.outlineOffset = '';
  canvasContainer.style.backgroundColor = '';

  const files = event.dataTransfer.files;
  if (files && files[0]) {
    const file = files[0];
    // Check if it's an image or video
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      await handleFileUpload(file);
    } else {
      alert('Please drop an image or video file.');
    }
  }
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

      pixelateImage(ctx, originalImg);

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

// Mix ratio slider (grayness)
document
  .getElementById('mixRatioRange')
  .addEventListener('input', function (event) {
    document.getElementById('mixRatioValue').value = parseFloat(
      event.target.value
    ).toFixed(2);
  });

document
  .getElementById('mixRatioRange')
  .addEventListener('change', function (event) {
    mixRatioValue = parseFloat(event.target.value);
    invalidateLUTCache();
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
    invalidateLUTCache();
    if (pixelatedIntermediate) shiftImage();
  });

// Seed input
document.getElementById('seedInput').addEventListener('change', function (event) {
  currentSeed = parseInt(event.target.value, 10);
  invalidateLUTCache();
  if (pixelatedIntermediate) shiftImage();
});

// Randomize seed button
document.getElementById('randomizeSeedBtn').addEventListener('click', function () {
  const newSeed = generateRandomSeed();
  currentSeed = newSeed;
  document.getElementById('seedInput').value = newSeed;
  invalidateLUTCache();
  if (pixelatedIntermediate) shiftImage();
});

// Fixed seed checkbox
document.getElementById('useFixedSeed').addEventListener('change', function (event) {
  useFixedSeed = event.target.checked;
  if (pixelatedIntermediate) shiftImage();
});

// Apply/Reset button
document.getElementById('applyBtn').addEventListener('click', async function () {
  const isActive = document.getElementById('applyBtn').classList.contains('active');

  if (isActive) {
    await resetImage();
    resetButton('applyBtn', 'Apply');
  } else if (currentImageSrc) {
    await processImage(currentImageSrc);
    toggleButton('applyBtn', 'Reset', 'Apply');
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

  const videoPlayer = document.getElementById('videoPlayer');
  videoPlayer.pause();

  const previewBtn = document.getElementById('previewFramesBtn');

  if (isPreviewing) {
    clearInterval(previewInterval);
    isPreviewing = false;
    resetButton('previewFramesBtn', 'Preview First 15 Frames');
    document.getElementById('canvas').style.display = 'none';
    videoPlayer.style.display = 'block';
    return;
  }

  previewBtn.disabled = true;
  previewBtn.textContent = 'Extracting frames...';

  try {
    if (videoFrames.length === 0) {
      const result = await extractVideoFrames(currentVideoSrc, 15, (progress) => {
        previewBtn.textContent = `Extracting: ${Math.floor(progress)}%`;
      });
      videoFrames = result.frames || result; // Handle both old and new format
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

  const processBtn = document.getElementById('processVideoBtn');

  // If already processing, cancel it
  if (isProcessingVideo) {
    cancelVideoProcessing = true;
    processBtn.textContent = 'Cancelling...';
    return;
  }

  stopAllActivity();

  const originalText = processBtn.textContent;
  isProcessingVideo = true;
  cancelVideoProcessing = false;

  processBtn.disabled = false; // Keep enabled so user can click to cancel
  processBtn.classList.add('processing');

  document.getElementById('canvas').style.display = 'block';
  document.getElementById('videoPlayer').style.display = 'none';

  try {
    setProcessBtnText('Extracting frames: 0%');
    const frameData = await extractVideoFrames(currentVideoSrc, 0, (progress) => {
      setProcessBtnText(`Extracting frames: ${Math.floor(progress)}%`);
    });

    // Check if cancelled during frame extraction
    if (cancelVideoProcessing) {
      console.log('Video processing cancelled during frame extraction');
      processBtn.textContent = originalText;
      processBtn.classList.remove('processing');
      isProcessingVideo = false;
      cancelVideoProcessing = false;
      isHoveringProcessBtn = false;
      return;
    }

    const allFrames = frameData.frames || frameData; // Handle both old and new format
    if (allFrames.length === 0) {
      alert('Failed to extract video frames');
      processBtn.disabled = false;
      processBtn.textContent = originalText;
      processBtn.classList.remove('processing');
      isProcessingVideo = false;
      return;
    }

    setProcessBtnText('Processing frames: 0%');
    // Use ffmpeg-based processing for faster-than-realtime encoding
    processedVideoBlob = await processFullVideo(frameData, (update) => {
      const { phase, progress } = update;
      const percent = Math.floor(progress);
      switch (phase) {
        case 'processing':
          setProcessBtnText(`Processing frames: ${percent}%`);
          break;
        case 'preparing':
          setProcessBtnText(`Preparing encoder: ${percent}%`);
          break;
        case 'encoding':
          setProcessBtnText(`Encoding video: ${percent}%`);
          break;
        default:
          setProcessBtnText(`Processing: ${percent}%`);
      }
    });

    // Check if cancelled during video processing
    if (cancelVideoProcessing) {
      console.log('Video processing cancelled during encoding');
      processBtn.textContent = originalText;
      processBtn.classList.remove('processing');
      isProcessingVideo = false;
      cancelVideoProcessing = false;
      isHoveringProcessBtn = false;
      cleanupIntermediateFrames();
      return;
    }

    // Give WASM a moment to fully release memory from processing
    console.log('Waiting for WASM memory cleanup...');
    await new Promise(resolve => setTimeout(resolve, 1000));  // Increased to 1 second
    console.log('Proceeding to audio muxing');

    // Mux audio back into the processed video
    let hasAudio = false;
    try {
      setProcessBtnText('Muxing audio...');
      const muxed = await muxOriginalAudioIntoProcessed(processedVideoBlob, currentVideoSrc);
      processedVideoBlob = muxed;
      hasAudio = true;
      console.log('Audio successfully muxed into processed video');
    } catch (e) {
      const errorMsg = e.message || e;
      console.warn('Audio mux failed; delivering video-only output. Reason:', errorMsg);

      // Show user-friendly message if it's a size/memory issue
      if (errorMsg.includes('too large') || errorMsg.includes('index out of bounds')) {
        console.info('Tip: For videos with audio, try a shorter clip (< 5 seconds) or use a desktop video editor to combine audio manually.');
      }
    }

    const videoPlayer = document.getElementById('videoPlayer');
    if (!processedVideoBlob?.size) {
      console.error('No processed video blob to play.');
      processBtn.disabled = false;
      processBtn.textContent = originalText;
      processBtn.classList.remove('processing');
      return;
    }

    if (videoPlayer.dataset.objUrl) {
      URL.revokeObjectURL(videoPlayer.dataset.objUrl);
    }
    if (videoDownloadUrl) {
      URL.revokeObjectURL(videoDownloadUrl);
    }

    const objUrl = URL.createObjectURL(processedVideoBlob);
    videoPlayer.dataset.objUrl = objUrl;
    videoPlayer.src = objUrl;
    videoPlayer.style.display = 'block';
    document.getElementById('canvas').style.display = 'none';

    videoDownloadUrl = objUrl;

    // Show completion status
    const completionText = hasAudio ? 'Complete!' : 'Complete! (no audio)';
    setProcessBtnText(completionText);

    // Clean up intermediate frames after video processing
    cleanupIntermediateFrames();

    // Reset processing state
    isProcessingVideo = false;
    cancelVideoProcessing = false;
    isHoveringProcessBtn = false;
    processBtn.classList.remove('processing');

    // Keep message longer if there's no audio (so user notices the warning)
    const messageDisplayTime = hasAudio ? 2000 : 5000;
    setTimeout(() => {
      processBtn.textContent = originalText;
    }, messageDisplayTime);

    processBtn.disabled = false;
  } catch (error) {
    console.error('Processing error:', error);

    // Don't show alert if user cancelled
    if (!cancelVideoProcessing) {
      alert('Failed to process video: ' + error.message);
    }

    processBtn.disabled = false;
    processBtn.textContent = originalText;
    processBtn.classList.remove('processing');

    // Reset processing state
    isProcessingVideo = false;
    cancelVideoProcessing = false;
    isHoveringProcessBtn = false;

    // Clean up intermediate frames on error
    cleanupIntermediateFrames();
  }
});

// Process video button hover behavior - show "Cancel" when hovering during processing
const processVideoBtn = document.getElementById('processVideoBtn');
let originalProcessText = '';
let isHoveringProcessBtn = false;

// Helper function to set process button text, respecting hover state
function setProcessBtnText(text) {
  if (isHoveringProcessBtn) {
    // User is hovering - update the stored text but keep showing "Cancel"
    originalProcessText = text;
  } else {
    // Not hovering - update the button text directly
    processVideoBtn.textContent = text;
  }
}

processVideoBtn.addEventListener('mouseenter', function () {
  if (isProcessingVideo && !cancelVideoProcessing) {
    isHoveringProcessBtn = true;
    originalProcessText = processVideoBtn.textContent;
    processVideoBtn.textContent = 'Cancel';
  }
});

processVideoBtn.addEventListener('mouseleave', function () {
  if (isProcessingVideo && !cancelVideoProcessing && originalProcessText) {
    isHoveringProcessBtn = false;
    processVideoBtn.textContent = originalProcessText;
    originalProcessText = '';
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
    if (videoDownloadUrl || processedVideoBlob) {
      const url = videoDownloadUrl || URL.createObjectURL(processedVideoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pixelated.webm';
      document.body.appendChild(a);
      requestAnimationFrame(() => {
        a.click();
        a.remove();
        if (!videoDownloadUrl) setTimeout(() => URL.revokeObjectURL(url), 30_000);
      });
    } else {
      alert('Process the video first.');
    }
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
    } else {
      const canvas = document.getElementById('canvas');
      if (canvas?.width) {
        canvas.toBlob((blob) => downloadBlob(blob, 'pixelated.png'), 'image/png');
      }
    }
  }
});
