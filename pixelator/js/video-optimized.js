// ============================================================================
// OPTIMIZED VIDEO PROCESSING
// - WebGL GPU acceleration for frame processing
// - Buffer reuse
// - Optimized frame extraction
// ============================================================================

/**
 * OPTIMIZED: Extract video frames using requestVideoFrameCallback
 * Much faster than seeking frame-by-frame
 */
async function extractVideoFrames(videoSrc, maxFrames = 0, progressCallback = null) {
  return extractFramesWithCallback(videoSrc, maxFrames, progressCallback);
}

/**
 * Modern approach using requestVideoFrameCallback (fastest!)
 */
async function extractFramesWithCallback(videoSrc, maxFrames = 0, progressCallback = null) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';

    const frames = [];
    let detectedFPS = null;
    let lastFrameTime = null;
    let frameTimes = [];
    let fps = 30; // Default, will be updated
    let frameInterval = 1 / fps;
    let nextFrameTime = 0;
    let callbackHandle = null;
    let lastFrameCount = 0;
    let stallCheckInterval = null;

    const maxDim = MAX_CANVAS_DIMENSION;
    const extractCanvas = document.createElement('canvas');
    const extractCtx = extractCanvas.getContext('2d', {
      willReadFrequently: true,
      alpha: false // Optimization: we don't need alpha
    });

    let canvasSized = false; // Track if we've explicitly set canvas dimensions

    const cleanup = () => {
      if (callbackHandle) video.cancelVideoFrameCallback(callbackHandle);
      if (stallCheckInterval) clearInterval(stallCheckInterval);
      video.pause();
      video.removeAttribute('src');
    };

    const onFrame = (now, metadata) => {
      // Check for cancellation
      if (typeof cancelVideoProcessing !== 'undefined' && cancelVideoProcessing) {
        console.log('Frame extraction cancelled by user');
        cleanup();
        reject(new Error('Frame extraction cancelled by user'));
        return;
      }

      const currentTime = metadata.mediaTime;

      // Detect framerate from first few frames
      if (detectedFPS === null && frames.length < 10) {
        if (lastFrameTime !== null) {
          const frameDelta = currentTime - lastFrameTime;
          if (frameDelta > 0) {
            frameTimes.push(frameDelta);
          }
        }
        lastFrameTime = currentTime;

        // After collecting a few samples, calculate average FPS
        if (frameTimes.length >= 5) {
          const avgFrameDelta = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
          detectedFPS = Math.round(1 / avgFrameDelta);
          fps = detectedFPS;
          frameInterval = 1 / fps;
          console.log(`Detected video framerate: ${detectedFPS} fps`);
        }
      }

      // Should we capture this frame?
      if (currentTime >= nextFrameTime) {
        // Set canvas size on first frame only (preserve aspect ratio, ensure even dimensions for video encoding)
        if (!canvasSized) {
          console.log(`Setting canvas size for first frame. Video dimensions: ${video.videoWidth}x${video.videoHeight}, maxDim: ${maxDim}`);

          // Ensure video dimensions are valid
          if (!video.videoWidth || !video.videoHeight) {
            console.error('Video dimensions not available yet:', video.videoWidth, video.videoHeight);
            callbackHandle = video.requestVideoFrameCallback(onFrame);
            return;
          }

          // Calculate scale factor to fit within maxDim while preserving aspect ratio
          const scale = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight);
          console.log(`Scale factor: min(${maxDim}/${video.videoWidth}, ${maxDim}/${video.videoHeight}) = ${scale}`);

          // Scale both dimensions proportionally
          let targetWidth = video.videoWidth * scale;
          let targetHeight = video.videoHeight * scale;
          console.log(`Target dimensions before rounding: ${targetWidth}x${targetHeight}`);

          // Ensure both dimensions are even (required for yuv420p)
          // Round to nearest even number to minimize aspect ratio distortion
          extractCanvas.width = Math.round(targetWidth / 2) * 2;
          extractCanvas.height = Math.round(targetHeight / 2) * 2;

          const originalAspect = video.videoWidth / video.videoHeight;
          const canvasAspect = extractCanvas.width / extractCanvas.height;
          console.log(`Canvas sized: ${extractCanvas.width}x${extractCanvas.height} | Original aspect: ${originalAspect.toFixed(4)}, Canvas aspect: ${canvasAspect.toFixed(4)}`);

          canvasSized = true; // Mark as sized
        }

        extractCtx.drawImage(video, 0, 0, extractCanvas.width, extractCanvas.height);
        const imageData = extractCtx.getImageData(0, 0, extractCanvas.width, extractCanvas.height);

        frames.push({
          imageData,
          timestamp: currentTime,
          width: extractCanvas.width,
          height: extractCanvas.height
        });

        nextFrameTime += frameInterval;

        if (progressCallback) {
          const progress = maxFrames > 0
            ? (frames.length / maxFrames) * 100
            : Math.min((currentTime / video.duration) * 100, 100);
          progressCallback(progress);
        }

        // Check if done
        const isDone = (maxFrames > 0 && frames.length >= maxFrames) ||
                       currentTime >= video.duration - 0.05 ||
                       video.ended;

        if (isDone) {
          console.log(`Frame extraction complete: ${frames.length} frames extracted`);
          cleanup();
          resolve({
            frames,
            fps: detectedFPS || 30 // Use detected FPS or fallback to 30
          });
          return;
        }
      }

      // Continue to next frame
      callbackHandle = video.requestVideoFrameCallback(onFrame);
    };

    // Add stall detection - if no new frames for 2 seconds, consider it done
    const checkForStall = () => {
      if (frames.length === lastFrameCount && frames.length > 0) {
        console.log(`Frame extraction stalled at ${frames.length} frames. Considering complete.`);
        cleanup();
        resolve({
          frames,
          fps: detectedFPS || 30
        });
      }
      lastFrameCount = frames.length;
    };

    // Add 'ended' event handler
    video.addEventListener('ended', () => {
      console.log(`Video ended event fired. Extracted ${frames.length} frames.`);
      if (frames.length > 0) {
        cleanup();
        resolve({
          frames,
          fps: detectedFPS || 30
        });
      }
    });

    video.addEventListener('loadedmetadata', async () => {
      console.log(`loadedmetadata - Video dimensions: ${video.videoWidth}x${video.videoHeight}, duration: ${video.duration}`);

      if (!video.duration || video.duration === Infinity || isNaN(video.duration)) {
        cleanup();
        reject(new Error('Invalid video duration'));
        return;
      }

      if (!video.videoWidth || !video.videoHeight) {
        cleanup();
        reject(new Error(`Invalid video dimensions: ${video.videoWidth}x${video.videoHeight}`));
        return;
      }

      try {
        // Start playback at high speed
        video.playbackRate = 2.0; // 2x speed for faster extraction
        await video.play();
        callbackHandle = video.requestVideoFrameCallback(onFrame);

        // Start stall detection (check every 2 seconds)
        stallCheckInterval = setInterval(checkForStall, 2000);
      } catch (err) {
        cleanup();
        reject(err);
      }
    });

    video.addEventListener('error', () => {
      cleanup();
      reject(new Error('Video loading failed'));
    });

    video.src = videoSrc;
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
async function processFullVideoOptimized(frameData, progressCallback = null) {
  const frames = frameData.frames || frameData; // Support both old and new format
  const fps = frameData.fps || 30; // Use detected FPS or default to 30
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
        console.log('Using GPU acceleration for video processing');
      } else {
        console.log('Using CPU for video processing');
      }

      /* -------------------------- build canvas stream --------------------------- */
      console.log(`Encoding video at ${fps} fps`);
      const canvasStream = canvas.captureStream(fps); // Capture at detected FPS
      const mixed = new MediaStream();

      const vidTracks = canvasStream.getVideoTracks();
      if (vidTracks.length) mixed.addTrack(vidTracks[0]);

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
        console.log(`MediaRecorder stopped. Captured ${chunks.length} chunks.`);
        const type = supported || 'video/webm';
        const blob = new Blob(chunks, { type });
        console.log(`Created blob of size: ${blob.size} bytes`);
        cleanup();

        // Clean up intermediate frames
        frames.forEach(frame => {
          if (frame && frame.imageData) {
            frame.imageData = null;
          }
        });
        frames.length = 0;

        console.log('Resolving promise with processed video blob');
        resolve(blob);
      };

      /* ----------------------- frame rendering / progress ---------------------- */
      const totalFrames = frames.length;
      let frameIndex = 0;
      let frameSeed = currentSeed;
      const frameInterval = 1000 / fps; // milliseconds per frame (33.33ms for 30fps)
      const startTime = Date.now();

      function processNextFrame() {
        if (frameIndex >= totalFrames) {
          // All frames rendered - wait a bit then stop
          console.log(`All ${totalFrames} frames rendered. Stopping MediaRecorder...`);
          setTimeout(() => {
            try {
              if (mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
              }
            } catch (e) {
              console.error('Error stopping MediaRecorder:', e);
            }
          }, 500);
          return;
        }

        // Calculate when this frame should be rendered to maintain 30fps timing
        const targetTime = startTime + (frameIndex * frameInterval);
        const currentTime = Date.now();
        const delay = Math.max(0, targetTime - currentTime);

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
          progressCallback(((frameIndex + 1) / totalFrames) * 100);
        }

        frameIndex++;

        // Schedule next frame to maintain 30fps timing
        setTimeout(processNextFrame, delay);
      }

      chunks = [];
      mediaRecorder.start(250);
      processNextFrame();

      function cleanup() {
        try {
          mixed.getTracks().forEach(t => t.stop());
          canvasStream.getTracks().forEach(t => t.stop());
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

/**
 * FFMPEG-based video processing - process as fast as possible!
 */
async function processFullVideoWithFFmpeg(frameData, progressCallback = null) {
  const frames = frameData.frames || frameData; // Support both old and new format
  const fps = frameData.fps || 30; // Use detected FPS or default to 30

  console.log('[PROCESS] Creating fresh FFmpeg instance for video processing...');

  // Create a fresh FFmpeg instance for video processing to avoid state corruption
  const { FFmpeg } = FFmpegWASM;
  const processingFFmpeg = new FFmpeg();

  console.log('[PROCESS] FFmpeg instance created');

  try {
    if (!frames.length) {
      throw new Error('No frames to process');
    }

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    canvas.width = frames[0].width;
    canvas.height = frames[0].height;

    // Initialize WebGL renderer for GPU acceleration
    const renderer = getWebGLRenderer(canvas);
    const useGPU = renderer.init();

    if (useGPU) {
      console.log('Using GPU acceleration for video processing');
    } else {
      console.log('Using CPU for video processing');
    }

    let lastError = null;
    processingFFmpeg.on('log', ({ type, message }) => {
      // Filter out "Aborted()" message from terminate() - it's expected and harmless
      if (message.includes('Aborted()')) return;

      // Filter out frame-by-frame progress logs (e.g., "frame= 123 fps=...")
      if (message.includes('frame=') && message.includes('fps=')) return;

      if (type === 'fferr') {
        lastError = message;
        console.error('FFmpeg (processing) ERROR:', message);
      } else {
        console.log('FFmpeg (processing):', message);
      }
    });

    if (progressCallback) progressCallback(0);

    const baseURL =
      window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');

    console.log('Loading fresh FFmpeg instance for video processing...');

    await processingFFmpeg.load({
      coreURL: baseURL + '/ffmpeg/ffmpeg-core.js',
      wasmURL: baseURL + '/ffmpeg/ffmpeg-core.wasm',
      workerURL: baseURL + '/ffmpeg/814.ffmpeg.js'
    });

    console.log('FFmpeg processing instance loaded successfully');

    const totalFrames = frames.length;
    let frameSeed = currentSeed;

    console.log(`Processing ${totalFrames} frames at ${fps} fps (${canvas.width}x${canvas.height})...`);

    // Process all frames to raw RGB data (much faster than PNG encoding!)
    const width = canvas.width;
    const height = canvas.height;
    const bytesPerFrame = width * height * 3; // RGB
    const rawVideoData = new Uint8Array(totalFrames * bytesPerFrame);

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      // Check for cancellation
      if (typeof cancelVideoProcessing !== 'undefined' && cancelVideoProcessing) {
        console.log('[PROCESS] Cancellation requested during frame processing');
        throw new Error('Processing cancelled by user');
      }

      const f = frames[frameIndex];
      frameSeed = generateDeterministicSeed(frameSeed, f.imageData);

      let imageData;
      if (useGPU) {
        const previousSeed = currentSeed;
        currentSeed = frameSeed;
        renderer.renderImageData(f.imageData);
        currentSeed = previousSeed;
        imageData = ctx.getImageData(0, 0, width, height);
      } else {
        imageData = processVideoFrameOptimized(f.imageData, f.width, f.height, frameSeed, null);
      }

      // Convert RGBA to RGB and write to buffer
      const offset = frameIndex * bytesPerFrame;
      const rgba = imageData.data;
      for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
        rawVideoData[offset + j] = rgba[i];     // R
        rawVideoData[offset + j + 1] = rgba[i + 1]; // G
        rawVideoData[offset + j + 2] = rgba[i + 2]; // B
      }

      if (progressCallback) {
        const frameProgress = ((frameIndex + 1) / totalFrames) * 100;
        progressCallback({
          phase: 'processing',
          progress: frameProgress
        });
      }
    }

    // Clean up intermediate frames after processing
    frames.forEach(frame => {
      if (frame && frame.imageData) {
        frame.imageData = null;
      }
    });
    frames.length = 0;

    console.log('All frames processed. Writing raw video data to ffmpeg...');
    if (progressCallback) {
      progressCallback({
        phase: 'preparing',
        progress: 0
      });
    }

    // Write raw video data to ffmpeg
    const inputName = 'input.rgb';
    await processingFFmpeg.writeFile(inputName, rawVideoData);

    console.log('Encoding video with ffmpeg...');
    if (progressCallback) {
      progressCallback({
        phase: 'encoding',
        progress: 0
      });
    }

    // Encode video with ffmpeg at 30fps from raw RGB data
    const outputName = 'output.webm';

    let lastProgress = 0;
    const progressHandler = ({ progress }) => {
      const percent = Math.round(progress * 100); // 0-100%
      if (percent > lastProgress && progressCallback) {
        lastProgress = percent;
        progressCallback({
          phase: 'encoding',
          progress: percent
        });
      }
    };

    processingFFmpeg.on('progress', progressHandler);

    try {
      await processingFFmpeg.exec([
        '-f', 'rawvideo',
        '-pixel_format', 'rgb24',
        '-video_size', `${width}x${height}`,
        '-framerate', String(fps),
        '-i', inputName,
        '-c:v', 'libvpx',
        '-b:v', '5M',
        '-pix_fmt', 'yuv420p',
        '-aspect', `${width}:${height}`, // Explicitly preserve aspect ratio
        '-auto-alt-ref', '0',
        outputName
      ]);
    } catch (execError) {
      const errorMsg = lastError || execError?.message || execError;
      throw new Error('FFmpeg encoding failed: ' + errorMsg);
    } finally {
      // Always clean up the progress listener
      processingFFmpeg.off('progress', progressHandler);
    }

    // Read the output video
    const videoData = await processingFFmpeg.readFile(outputName);

    // Clean up files
    try { await processingFFmpeg.deleteFile(inputName); } catch {}
    try { await processingFFmpeg.deleteFile(outputName); } catch {}

    // Terminate the FFmpeg instance to free memory
    try {
      console.log('[PROCESS] Terminating FFmpeg instance...');
      await processingFFmpeg.terminate();
      console.log('[PROCESS] FFmpeg instance terminated');
    } catch (e) {
      console.warn('[PROCESS] Failed to terminate FFmpeg instance:', e);
    }

    console.log('Video encoding complete!');

    return new Blob([videoData.buffer], { type: 'video/webm' });
  } catch (err) {
    // Clean up intermediate frames on error
    frames.forEach(frame => {
      if (frame && frame.imageData) {
        frame.imageData = null;
      }
    });
    frames.length = 0;

    // Terminate the FFmpeg instance on error to free memory
    try {
      console.log('[PROCESS] Terminating FFmpeg instance (error cleanup)...');
      await processingFFmpeg.terminate();
      console.log('[PROCESS] FFmpeg instance terminated (error cleanup)');
    } catch (e) {
      console.warn('[PROCESS] Failed to terminate FFmpeg instance on error:', e);
    }

    throw err;
  }
}

/**
 * Wrapper for backwards compatibility
 */
async function processFullVideo(frames, progressCallback = null) {
  return processFullVideoWithFFmpeg(frames, progressCallback);
}
