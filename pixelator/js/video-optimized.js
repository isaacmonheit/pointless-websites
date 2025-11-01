// ============================================================================
// OPTIMIZED VIDEO PROCESSING
// - WebGL GPU acceleration for frame processing
// - Buffer reuse
// - Optimized frame extraction
// ============================================================================

/**
 * Extract video frames (same as before, but optimized)
 */
async function extractVideoFrames(videoSrc, maxFrames = 0, progressCallback = null) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';

    const frames = [];
    let frameCount = 0;
    let isExtracting = false;
    let isSeeking = false;
    let timeoutId = null;
    let lastProgressTime = Date.now();

    const checkTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (Date.now() - lastProgressTime > 10000) {
          cleanup();
          reject(
            new Error(
              'Video extraction timed out. The video format may not be supported by your browser.'
            )
          );
        }
      }, 10000);
    };

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      video.src = '';
      video.load();
    };

    const handleError = (e) => {
      cleanup();
      const errorMsg = video.error
        ? `Video error code ${video.error.code}: ${getVideoErrorMessage(
            video.error.code
          )}`
        : (e && e.message) || 'Unknown error loading video';
      reject(new Error(errorMsg));
    };

    const getVideoErrorMessage = (code) => {
      switch (code) {
        case 1:
          return 'MEDIA_ERR_ABORTED - Video loading was aborted';
        case 2:
          return 'MEDIA_ERR_NETWORK - Network error while loading video';
        case 3:
          return 'MEDIA_ERR_DECODE - Video format not supported or corrupted';
        case 4:
          return 'MEDIA_ERR_SRC_NOT_SUPPORTED - Video format not supported';
        default:
          return 'Unknown error';
      }
    };

    video.addEventListener('error', handleError);

    video.addEventListener('loadeddata', () => {
      if (isExtracting) return;
      isExtracting = true;

      const duration = video.duration;

      if (!duration || duration === Infinity || isNaN(duration)) {
        cleanup();
        reject(
          new Error(
            'Invalid video duration. Video may be corrupted or unsupported format.'
          )
        );
        return;
      }

      const fps = 30;
      const frameInterval = 1 / fps;
      let currentTime = 0;

      const extractCanvas = document.createElement('canvas');
      const extractCtx = extractCanvas.getContext('2d', { willReadFrequently: true });

      const onSeeked = () => {
        if (!isSeeking) return;
        isSeeking = false;
        lastProgressTime = Date.now();
        checkTimeout();

        try {
          const maxDim = MAX_CANVAS_DIMENSION;
          extractCanvas.width =
            video.videoWidth >= video.videoHeight
              ? maxDim
              : Math.floor((video.videoWidth / video.videoHeight) * maxDim);
          extractCanvas.height =
            video.videoHeight >= video.videoWidth
              ? maxDim
              : Math.floor((video.videoHeight / video.videoWidth) * maxDim);

          extractCtx.drawImage(
            video,
            0,
            0,
            extractCanvas.width,
            extractCanvas.height
          );

          // Store as ImageBitmap for GPU rendering (when available)
          const imageData = extractCtx.getImageData(
            0,
            0,
            extractCanvas.width,
            extractCanvas.height
          );

          frames.push({
            imageData,
            timestamp: currentTime,
            width: extractCanvas.width,
            height: extractCanvas.height
          });

          frameCount++;
          currentTime += frameInterval;

          if (progressCallback) {
            const progress =
              maxFrames > 0
                ? (frameCount / maxFrames) * 100
                : Math.min((currentTime / duration) * 100, 100);
            progressCallback(progress);
          }

          if (
            (maxFrames > 0 && frameCount >= maxFrames) ||
            currentTime >= duration
          ) {
            video.removeEventListener('seeked', onSeeked);
            cleanup();
            resolve(frames);
            return;
          }

          seekToNextFrame();
        } catch (err) {
          cleanup();
          reject(new Error('Error extracting frame: ' + err.message));
        }
      };

      const seekToNextFrame = () => {
        isSeeking = true;
        video.currentTime = Math.min(currentTime, duration - 0.001);
      };

      video.addEventListener('seeked', onSeeked);
      checkTimeout();
      seekToNextFrame();
    });

    video.src = videoSrc;
    video.load();
  });
}

/**
 * OPTIMIZED: Process one frame with WebGL
 */
function processVideoFrameOptimized(frameData, width, height, frameSeed, renderer) {
  // Try GPU first
  if (renderer) {
    const previousSeed = currentSeed;
    currentSeed = frameSeed;

    // Render directly with GPU
    const success = renderer.renderImageData(frameData);

    currentSeed = previousSeed;

    if (success) {
      // Read back from GPU (this is still needed for MediaRecorder)
      const canvas = renderer.canvas;
      const ctx = canvas.getContext('2d');
      return ctx.getImageData(0, 0, width, height);
    }
  }

  // CPU fallback
  tempCanvas.width = width;
  tempCanvas.height = height;
  tempCtx.putImageData(frameData, 0, 0);

  if (pixelationValue > 1) {
    const scaledWidth = Math.floor(width / pixelationValue);
    const scaledHeight = Math.floor(height / pixelationValue);
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, scaledWidth, scaledHeight);
    tempCtx.drawImage(tempCanvas, 0, 0, scaledWidth, scaledHeight, 0, 0, width, height);
  }

  let imageData = tempCtx.getImageData(0, 0, width, height);

  const previousSeed = currentSeed;
  currentSeed = frameSeed;
  imageData = replaceColorsOptimized(imageData);
  currentSeed = previousSeed;

  return imageData;
}

/**
 * CPU fallback for video frame processing
 */
function processVideoFrame(frameData, width, height, frameSeed) {
  return processVideoFrameOptimized(frameData, width, height, frameSeed, null);
}

/**
 * OPTIMIZED: Process full video with GPU acceleration
 */
async function processFullVideoOptimized(frames, progressCallback = null) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!frames.length) {
        reject(new Error('No frames to process'));
        return;
      }

      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      canvas.width  = frames[0].width;
      canvas.height = frames[0].height;

      // Initialize WebGL renderer for GPU acceleration
      const renderer = getWebGLRenderer(canvas);
      const useGPU = renderer.init();

      if (useGPU) {
        console.log('🚀 Using GPU acceleration for video processing');
      } else {
        console.log('Using CPU for video processing');
      }

      /* -------------------------- set up audio source -------------------------- */
      const audioEl = document.createElement('video');
      audioEl.style.display = 'none';
      audioEl.preload = 'auto';
      audioEl.src = currentVideoSrc;
      audioEl.crossOrigin = 'anonymous';
      audioEl.muted = false;
      audioEl.volume = 1.0;
      document.body.appendChild(audioEl);

      await audioEl.play().catch(async () => {
        audioEl.load();
        await audioEl.play();
      });

      const audioStream = audioEl.captureStream
        ? audioEl.captureStream()
        : (audioEl.mozCaptureStream && audioEl.mozCaptureStream()) || null;

      if (!audioStream) {
        console.warn('captureStream() not available for audio; proceeding video-only.');
      }

      /* -------------------------- build mixed stream --------------------------- */
      const canvasStream = canvas.captureStream(30);
      const mixed = new MediaStream();

      const vidTracks = canvasStream.getVideoTracks();
      if (vidTracks.length) mixed.addTrack(vidTracks[0]);

      const audTracks = audioStream ? audioStream.getAudioTracks() : [];
      if (audTracks.length) mixed.addTrack(audTracks[0]);

      /* ----------------------------- pick mimeType ----------------------------- */
      const candidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=opus',
        'video/webm'
      ];
      const supported = (window.MediaRecorder && MediaRecorder.isTypeSupported)
        ? (candidates.find(t => MediaRecorder.isTypeSupported(t)) || '')
        : '';

      const mrOpts = supported
        ? { mimeType: supported, videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 128_000 }
        : { videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 128_000 };

      let chunks = [];
      const mediaRecorder = new MediaRecorder(mixed, mrOpts);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };

      mediaRecorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        cleanup();
        reject(new Error('MediaRecorder error: ' + (e.error?.message || e.message || 'unknown')));
      };

      mediaRecorder.onstop = () => {
        const type = supported || 'video/webm';
        const blob = new Blob(chunks, { type });
        cleanup();
        resolve(blob);
      };

      /* ----------------------- frame rendering / progress ---------------------- */
      const totalFrames = frames.length;
      let frameIndex = 0;
      let frameSeed = currentSeed;

      const hasTimestamps = frames.every(f => typeof f.timestamp === 'number');
      const fps = 30;
      const frameInterval = 1 / fps;
      const startTime = performance.now();

      function tick(now) {
        let targetIdx;
        if (hasTimestamps) {
          const elapsed = (now - startTime) / 1000;
          targetIdx = Math.min(
            frames.findIndex(f => f.timestamp > elapsed) - 1,
            totalFrames - 1
          );
          if (targetIdx < 0) targetIdx = Math.min(Math.floor(elapsed * fps), totalFrames - 1);
        } else {
          const elapsed = (now - startTime) / 1000;
          targetIdx = Math.min(Math.floor(elapsed / frameInterval), totalFrames - 1);
        }

        if (targetIdx >= frameIndex) {
          for (; frameIndex <= targetIdx && frameIndex < totalFrames; frameIndex++) {
            const f = frames[frameIndex];
            frameSeed = generateDeterministicSeed(frameSeed, f.imageData);

            if (useGPU) {
              // GPU path: render directly to canvas
              const previousSeed = currentSeed;
              currentSeed = frameSeed;
              renderer.renderImageData(f.imageData);
              currentSeed = previousSeed;
            } else {
              // CPU path
              const processed = processVideoFrameOptimized(f.imageData, f.width, f.height, frameSeed, null);
              ctx.putImageData(processed, 0, 0);
            }

            if (progressCallback) {
              progressCallback((frameIndex / totalFrames) * 100);
            }
          }
        }

        const audioEnded = audioEl.ended || (audioEl.duration && audioEl.currentTime >= audioEl.duration);
        if (frameIndex >= totalFrames - 1 || audioEnded) {
          setTimeout(() => {
            try { mediaRecorder.stop(); } catch (_) {}
          }, 120);
          return;
        }

        requestAnimationFrame(tick);
      }

      chunks = [];
      mediaRecorder.start(250);
      requestAnimationFrame(tick);

      function cleanup() {
        try {
          mixed.getTracks().forEach(t => t.stop());
          if (audioStream) audioStream.getTracks().forEach(t => t.stop());
          canvasStream.getTracks().forEach(t => t.stop());
        } catch (_) {}

        try {
          audioEl.pause();
          audioEl.src = '';
          audioEl.remove();
        } catch (_) {}
      }
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Wrapper for backwards compatibility
 */
async function processFullVideo(frames, progressCallback = null) {
  return processFullVideoOptimized(frames, progressCallback);
}
