// ============================================================================
// VIDEO PROCESSING
// ============================================================================

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
      video.removeAttribute('src');
      video.removeEventListener('error', handleError);
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

      const fps = 24; // Optimized FPS
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
 * Process one frame
 */
function processVideoFrame(frameData, width, height, frameSeed) {
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
  imageData = replaceColors(imageData);
  currentSeed = previousSeed;

  return imageData;
}

/**
 * Processes entire video and creates downloadable output WITH AUDIO
 * - Combines canvas video track + audio track from the original source element
 * - Tries vp9/opus → vp8/opus → webm/opus fallbacks
 * - Uses requestAnimationFrame for smoother pacing; stops exactly at audio end
 * @param {Array} frames - Array of frame objects
 * @param {Function} progressCallback - Progress update callback
 * @returns {Promise<Blob>} Processed video blob
 */
async function processFullVideo(frames, progressCallback = null) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!frames.length) {
        reject(new Error('No frames to process'));
        return;
      }

      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      // Canvas sizing from first frame
      canvas.width  = frames[0].width;
      canvas.height = frames[0].height;

      /* -------------------------- set up audio source -------------------------- */
      // A dedicated hidden <video> to play the original and provide its audio
      const audioEl = document.createElement('video');
      audioEl.style.display = 'none';
      audioEl.preload = 'auto';
      audioEl.src = currentVideoSrc;     // same data URL/file you loaded
      audioEl.crossOrigin = 'anonymous'; // harmless for data: / same-origin
      audioEl.muted = false;             // we need the audio!
      audioEl.volume = 1.0;
      document.body.appendChild(audioEl);

      // Must wait for it to be able to play before captureStream
      await audioEl.play().catch(async () => {
        // Some browsers require a load() then play() after attach
        audioEl.load();
        await audioEl.play();
      });

      // Capture the audio track (some browsers expose it only while playing)
      const audioStream = audioEl.captureStream
        ? audioEl.captureStream()
        : (audioEl.mozCaptureStream && audioEl.mozCaptureStream()) || null;

      if (!audioStream) {
        // Graceful fallback: continue without audio
        console.warn('captureStream() not available for audio; proceeding video-only.');
      }

      /* -------------------------- build mixed stream --------------------------- */
      const canvasStream = canvas.captureStream(30); // 30 FPS
      const mixed = new MediaStream();

      // Video track from canvas
      const vidTracks = canvasStream.getVideoTracks();
      if (vidTracks.length) mixed.addTrack(vidTracks[0]);

      // Audio track from audioEl
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

        // Clean up intermediate frames on error
        frames.forEach(frame => {
          if (frame && frame.imageData) {
            frame.imageData = null;
          }
        });
        frames.length = 0;

        reject(new Error('MediaRecorder error: ' + (e.error?.message || e.message || 'unknown')));
      };

      mediaRecorder.onstop = () => {
        const type = supported || 'video/webm';
        const blob = new Blob(chunks, { type });
        cleanup();

        // Clean up intermediate frames
        frames.forEach(frame => {
          if (frame && frame.imageData) {
            frame.imageData = null;
          }
        });
        frames.length = 0;

        resolve(blob);
      };

      /* ----------------------- frame rendering / progress ---------------------- */
      const totalFrames = frames.length;
      let frameIndex = 0;
      let frameSeed = currentSeed;

      // Use timestamps if present; otherwise assume constant 30 fps timeline
      const hasTimestamps = frames.every(f => typeof f.timestamp === 'number');
      const fps = 24; // Optimized FPS
      const frameInterval = 1 / fps;
      const startTime = performance.now();

      function tick(now) {
        // Choose the frame to draw based on elapsed time for better A/V sync
        let targetIdx;
        if (hasTimestamps) {
          const elapsed = (now - startTime) / 1000;
          // Find closest frame whose timestamp <= elapsed
          targetIdx = Math.min(
            frames.findIndex(f => f.timestamp > elapsed) - 1,
            totalFrames - 1
          );
          if (targetIdx < 0) targetIdx = Math.min(Math.floor(elapsed * fps), totalFrames - 1);
        } else {
          const elapsed = (now - startTime) / 1000;
          targetIdx = Math.min(Math.floor(elapsed / frameInterval), totalFrames - 1);
        }

        // Only advance forward; draw each frame once
        if (targetIdx >= frameIndex) {
          for (; frameIndex <= targetIdx && frameIndex < totalFrames; frameIndex++) {
            const f = frames[frameIndex];
            frameSeed = generateDeterministicSeed(frameSeed, f.imageData);
            const processed = processVideoFrame(f.imageData, f.width, f.height, frameSeed);
            ctx.putImageData(processed, 0, 0);

            if (progressCallback) {
              progressCallback((frameIndex / totalFrames) * 100);
            }
          }
        }

        // Stop when we've drawn the last frame or audio ended
        const audioEnded = audioEl.ended || (audioEl.duration && audioEl.currentTime >= audioEl.duration);
        if (frameIndex >= totalFrames - 1 || audioEnded) {
          // Give the recorder a breath so the last keyframe/packet flushes
          setTimeout(() => {
            try { mediaRecorder.stop(); } catch (_) {}
          }, 120);
          return;
        }

        requestAnimationFrame(tick);
      }

      // Start recording and the render loop
      chunks = [];
      mediaRecorder.start(250); // timeslice to force regular dataavailable events
      requestAnimationFrame(tick);

      /* ------------------------------- cleanup -------------------------------- */
      function cleanup() {
        try {
          // Stop tracks
          mixed.getTracks().forEach(t => t.stop());
          if (audioStream) audioStream.getTracks().forEach(t => t.stop());
          canvasStream.getTracks().forEach(t => t.stop());
        } catch (_) {}

        // Stop and detach audio element
        try {
          audioEl.pause();
          audioEl.removeAttribute('src');
          audioEl.remove();
        } catch (_) {}
      }
    } catch (err) {
      // Clean up intermediate frames on error
      frames.forEach(frame => {
        if (frame && frame.imageData) {
          frame.imageData = null;
        }
      });
      frames.length = 0;

      reject(err);
    }
  });
}
