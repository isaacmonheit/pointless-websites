// ============================================================================
// VIDEO PROCESSING
// ============================================================================

/**
 * Extract video frames using simple seeking
 * Extracts at 30fps - simple and reliable
 */
async function extractVideoFrames(videoSrc, maxFrames = 0, progressCallback = null) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.src = videoSrc;

    const frames = [];
    const FPS = 30;
    const frameInterval = 1 / FPS;
    let currentTime = 0;
    let canvasSized = false;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const extractFrame = () => {
      if (typeof cancelVideoProcessing !== 'undefined' && cancelVideoProcessing) {
        reject(new Error('Cancelled'));
        return;
      }

      // First frame: set canvas size
      if (!canvasSized) {
        const maxDim = MAX_CANVAS_DIMENSION;
        const scale = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight);
        canvas.width = Math.round(video.videoWidth * scale / 2) * 2;
        canvas.height = Math.round(video.videoHeight * scale / 2) * 2;
        canvasSized = true;
      }

      // Capture frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      frames.push({
        imageData,
        timestamp: currentTime,
        width: canvas.width,
        height: canvas.height
      });

      if (progressCallback) {
        progressCallback((currentTime / video.duration) * 100);
      }

      // Next frame
      currentTime += frameInterval;

      if ((maxFrames > 0 && frames.length >= maxFrames) || currentTime >= video.duration) {
        resolve({ frames, fps: FPS });
      } else {
        video.currentTime = Math.min(currentTime, video.duration - 0.001);
      }
    };

    video.addEventListener('seeked', extractFrame);
    video.addEventListener('loadedmetadata', () => {
      if (!video.duration || !video.videoWidth) {
        reject(new Error('Invalid video'));
        return;
      }
      video.currentTime = 0;
    });
    video.addEventListener('error', () => reject(new Error('Video loading failed')));
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
 * Process video frames and encode with FFmpeg
 */
async function processFullVideo(frameData, progressCallback = null) {
  const frames = frameData.frames || frameData;
  const fps = frameData.fps || 30;

  const { FFmpeg } = FFmpegWASM;
  const ffmpeg = new FFmpeg();

  try {
    // Load FFmpeg
    const baseURL = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
    await ffmpeg.load({
      coreURL: baseURL + '/ffmpeg/ffmpeg-core.js',
      wasmURL: baseURL + '/ffmpeg/ffmpeg-core.wasm',
      workerURL: baseURL + '/ffmpeg/814.ffmpeg.js'
    });

    // Process frames to RGB buffer
    const width = frames[0].width;
    const height = frames[0].height;
    const bytesPerFrame = width * height * 3;
    const rawVideoData = new Uint8Array(frames.length * bytesPerFrame);

    let frameSeed = currentSeed;
    for (let i = 0; i < frames.length; i++) {
      if (typeof cancelVideoProcessing !== 'undefined' && cancelVideoProcessing) {
        throw new Error('Cancelled');
      }

      const f = frames[i];
      frameSeed = generateDeterministicSeed(frameSeed, f.imageData);

      const imageData = processVideoFrame(f.imageData, f.width, f.height, frameSeed);

      // Convert RGBA to RGB
      const offset = i * bytesPerFrame;
      const rgba = imageData.data;
      for (let j = 0, k = 0; j < rgba.length; j += 4, k += 3) {
        rawVideoData[offset + k] = rgba[j];
        rawVideoData[offset + k + 1] = rgba[j + 1];
        rawVideoData[offset + k + 2] = rgba[j + 2];
      }

      if (progressCallback) {
        progressCallback({
          phase: 'processing',
          progress: ((i + 1) / frames.length) * 100
        });
      }
    }

    // Clean up frames
    frames.forEach(f => { if (f.imageData) f.imageData = null; });
    frames.length = 0;

    // Write to FFmpeg
    await ffmpeg.writeFile('input.rgb', rawVideoData);

    // Encode
    if (progressCallback) {
      progressCallback({ phase: 'encoding', progress: 0 });
    }

    const progressHandler = ({ progress }) => {
      if (progressCallback) {
        progressCallback({
          phase: 'encoding',
          progress: Math.round(progress * 100)
        });
      }
    };
    ffmpeg.on('progress', progressHandler);

    await ffmpeg.exec([
      '-f', 'rawvideo',
      '-pixel_format', 'rgb24',
      '-video_size', `${width}x${height}`,
      '-framerate', String(fps),
      '-i', 'input.rgb',
      '-c:v', 'libvpx',
      '-b:v', '5M',
      '-pix_fmt', 'yuv420p',
      '-auto-alt-ref', '0',
      'output.webm'
    ]);

    ffmpeg.off('progress', progressHandler);

    const videoData = await ffmpeg.readFile('output.webm');
    await ffmpeg.terminate();

    return new Blob([videoData.buffer], { type: 'video/webm' });
  } catch (err) {
    frames.forEach(f => { if (f.imageData) f.imageData = null; });
    frames.length = 0;
    try { await ffmpeg.terminate(); } catch {}
    throw err;
  }
}
