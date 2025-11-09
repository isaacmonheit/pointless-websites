async function initFFmpeg() {
  if (ffmpegLoaded) return;

  const { FFmpeg } = FFmpegWASM;
  ffmpeg = new FFmpeg();

  await loadFFmpeg(ffmpeg);
  ffmpegLoaded = true;
}

function needsConversion(file) {
  const fileName = file.name.toLowerCase();
  const fileType = (file.type || '').toLowerCase();

  const problematicFormats = ['.mov', '.avi', '.wmv', '.flv', '.mkv', '.m4v'];
  const problematicTypes = [
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv',
    'video/x-flv',
    'video/x-matroska'
  ];

  return (
    problematicFormats.some((ext) => fileName.endsWith(ext)) ||
    problematicTypes.some((type) => fileType === type)
  );
}

/**
 * Setup FFmpeg logger that filters noise
 */
function setupFFmpegLogger(ffmpeg, prefix = 'FFmpeg') {
  let lastError = null;
  ffmpeg.on('log', ({ type, message }) => {
    if (message.includes('Aborted()') ||
        (message.includes('frame=') && message.includes('fps=')) ||
        (message.includes('size=') && message.includes('time=') && message.includes('bitrate='))) {
      return;
    }
    if (type === 'fferr') {
      lastError = message;
      console.error(`${prefix} ERROR:`, message);
    }
  });
  return { getLastError: () => lastError };
}

/**
 * Get base URL for FFmpeg files
 */
function getFFmpegBaseURL() {
  return window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
}

/**
 * Load FFmpeg with standard config
 */
async function loadFFmpeg(ffmpeg) {
  const baseURL = getFFmpegBaseURL();
  await ffmpeg.load({
    coreURL: baseURL + '/ffmpeg/ffmpeg-core.js',
    wasmURL: baseURL + '/ffmpeg/ffmpeg-core.wasm',
    workerURL: baseURL + '/ffmpeg/814.ffmpeg.js'
  });
}

/**
 * Cleanup FFmpeg files
 */
async function cleanupFFmpegFiles(ffmpeg, ...filenames) {
  for (const filename of filenames) {
    try { await ffmpeg.deleteFile(filename); } catch {}
  }
}

async function convertVideoToWebM(file, progressCallback = null) {
  const { FFmpeg } = FFmpegWASM;
  const { fetchFile } = FFmpegUtil;
  const convertFFmpeg = new FFmpeg();

  const { getLastError } = setupFFmpegLogger(convertFFmpeg, '[CONVERT]');
  if (progressCallback) progressCallback('Loading converter...', 0);

  await loadFFmpeg(convertFFmpeg);

  const fileName = file.name;
  const inputName = 'input' + fileName.substring(fileName.lastIndexOf('.'));
  const outputName = 'output.webm';

  try {
    if (progressCallback) progressCallback('Converting video...', 0);

    await convertFFmpeg.writeFile(inputName, await fetchFile(file));

    let lastProgress = 0;
    const progressHandler = ({ progress }) => {
      const percent = Math.round(progress * 100);
      if (percent > lastProgress) {
        lastProgress = percent;
        progressCallback?.('Converting video...', percent);
      }
    };

    convertFFmpeg.on('progress', progressHandler);

    try {
      await convertFFmpeg.exec([
        '-i', inputName,
        '-c:v', 'libvpx',
        '-b:v', '2M',
        '-c:a', 'libvorbis',
        '-auto-alt-ref', '0',
        outputName
      ]);
    } finally {
      convertFFmpeg.off('progress', progressHandler);
    }

    const data = await convertFFmpeg.readFile(outputName);
    await cleanupFFmpegFiles(convertFFmpeg, inputName, outputName);

    progressCallback?.('Conversion complete!', 100);

    return new Blob([data.buffer], { type: 'video/webm' });
  } catch (e) {
    await cleanupFFmpegFiles(convertFFmpeg, inputName, outputName);
    const errorMsg = getLastError() || e?.message || e;
    throw new Error('Conversion failed: ' + errorMsg);
  } finally {
    try { await convertFFmpeg.terminate(); } catch {}
  }
}

async function muxOriginalAudioIntoProcessed(processedVideoBlob, originalVideoSrc) {
  const { FFmpeg } = FFmpegWASM;
  const muxFFmpeg = new FFmpeg();

  const { getLastError } = setupFFmpegLogger(muxFFmpeg, '[MUX]');
  await loadFFmpeg(muxFFmpeg);

  // Detect original video format
  let originalExtension = '.webm';
  if (originalVideoSrc.startsWith('data:')) {
    const mimeMatch = originalVideoSrc.match(/^data:(.*?);/);
    if (mimeMatch) {
      const mimeType = mimeMatch[1];
      if (mimeType.includes('mp4')) originalExtension = '.mp4';
      else if (mimeType.includes('quicktime')) originalExtension = '.mov';
    }
  }

  const inProcessed = 'processed.webm';
  const inOriginal = 'original' + originalExtension;
  const extractedAudio = 'audio.webm';
  const outName = 'muxed.webm';

  try {
    await cleanupFFmpegFiles(muxFFmpeg, inProcessed, inOriginal, extractedAudio, outName);

    let processedBytes = await uint8FromBlob(processedVideoBlob);
    let origBytes = await fetchBytesFromSrc(originalVideoSrc);

    // STEP 1: Extract audio from original
    try {
      await muxFFmpeg.writeFile(inOriginal, origBytes);
    } catch (writeError) {
      throw new Error(`Failed to load video into FFmpeg: ${writeError.message || writeError}. Video may be too large for browser WASM memory limits.`);
    }

    origBytes = null;

    try {
      await muxFFmpeg.exec([
        '-i', inOriginal,
        '-vn',
        '-c:a', 'libopus',
        '-b:a', '128k',
        extractedAudio
      ]);
    } catch (extractError) {
      const errorMsg = extractError.message || String(extractError);
      if (errorMsg.includes('out of bounds') || errorMsg.includes('out of memory')) {
        throw new Error('Audio extraction failed due to memory constraints. Try a shorter video.');
      }
      throw new Error(`Audio extraction failed: ${errorMsg}`);
    }

    await muxFFmpeg.deleteFile(inOriginal);
    if (typeof gc === 'function') gc();

    // STEP 2: Mux audio with processed video
    await muxFFmpeg.writeFile(inProcessed, processedBytes);
    processedBytes = null;

    try {
      await muxFFmpeg.exec([
        '-i', inProcessed,
        '-i', extractedAudio,
        '-c:v', 'copy',
        '-c:a', 'copy',
        '-shortest',
        '-avoid_negative_ts', 'make_zero',
        '-fflags', '+genpts',
        outName
      ]);
    } catch (muxError) {
      const errorMsg = muxError.message || String(muxError);
      if (errorMsg.includes('out of bounds') || errorMsg.includes('out of memory')) {
        throw new Error('Audio muxing failed due to memory constraints. Try a shorter video.');
      }
      throw new Error(`Audio muxing failed: ${errorMsg}`);
    }

    const outData = await muxFFmpeg.readFile(outName);
    await cleanupFFmpegFiles(muxFFmpeg, inProcessed, inOriginal, extractedAudio, outName);

    return new Blob([outData.buffer], { type: 'video/webm' });
  } catch (e) {
    await cleanupFFmpegFiles(muxFFmpeg, inProcessed, inOriginal, extractedAudio, outName);
    const errorMsg = getLastError() || e?.message || e;
    throw new Error('Mux failed: ' + errorMsg);
  } finally {
    try { await muxFFmpeg.terminate(); } catch {}
  }
}
