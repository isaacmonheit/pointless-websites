// ============================================================================
// FFMPEG VIDEO (INIT + CONVERT + MUX)
// ============================================================================

async function initFFmpeg() {
  if (ffmpegLoaded) return;

  const { FFmpeg } = FFmpegWASM;
  ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    console.log('FFmpeg:', message);
  });

  const baseURL =
    window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');

  await ffmpeg.load({
    coreURL: baseURL + '/ffmpeg/ffmpeg-core.js',
    wasmURL: baseURL + '/ffmpeg/ffmpeg-core.wasm',
    workerURL: baseURL + '/ffmpeg/814.ffmpeg.js'
  });

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

async function convertVideoToWebM(file, progressCallback = null) {
  console.log('[CONVERT] Creating fresh FFmpeg instance for video conversion...');

  // Create a fresh FFmpeg instance for conversion to avoid state corruption
  const { FFmpeg } = FFmpegWASM;
  const { fetchFile } = FFmpegUtil;
  const convertFFmpeg = new FFmpeg();

  console.log('[CONVERT] FFmpeg instance created');

  let lastError = null;
  convertFFmpeg.on('log', ({ type, message }) => {
    // Filter out "Aborted()" message from terminate() - it's expected and harmless
    if (message.includes('Aborted()')) return;

    // Filter out frame-by-frame progress logs (e.g., "frame= 123 fps=...")
    if (message.includes('frame=') && message.includes('fps=')) return;

    if (type === 'fferr') {
      lastError = message;
      console.error('FFmpeg (convert) ERROR:', message);
    } else {
      console.log('FFmpeg (convert):', message);
    }
  });

  if (progressCallback) progressCallback('Loading converter...', 0);

  const baseURL =
    window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');

  console.log('Loading fresh FFmpeg instance for video conversion...');

  await convertFFmpeg.load({
    coreURL: baseURL + '/ffmpeg/ffmpeg-core.js',
    wasmURL: baseURL + '/ffmpeg/ffmpeg-core.wasm',
    workerURL: baseURL + '/ffmpeg/814.ffmpeg.js'
  });

  console.log('FFmpeg instance loaded successfully');

  const fileName = file.name;
  const inputName = 'input' + fileName.substring(fileName.lastIndexOf('.'));
  const outputName = 'output.webm';

  try {
    if (progressCallback) progressCallback('Converting video...', 0);

    await convertFFmpeg.writeFile(inputName, await fetchFile(file));

    let lastProgress = 0;
    const progressHandler = ({ progress }) => {
      const percent = Math.round(progress * 100); // 0-100%
      if (percent > lastProgress) {
        lastProgress = percent;
        if (progressCallback)
          progressCallback('Converting video...', percent);
      }
    };

    convertFFmpeg.on('progress', progressHandler);

    try {
      await convertFFmpeg.exec([
        '-i',
        inputName,
        '-c:v',
        'libvpx',
        '-b:v',
        '2M',
        '-c:a',
        'libvorbis',
        '-auto-alt-ref',
        '0',
        outputName
      ]);
    } finally {
      convertFFmpeg.off('progress', progressHandler);
    }

    const data = await convertFFmpeg.readFile(outputName);

    // Clean up
    try { await convertFFmpeg.deleteFile(inputName); } catch {}
    try { await convertFFmpeg.deleteFile(outputName); } catch {}

    if (progressCallback) progressCallback('Conversion complete!', 100);

    return new Blob([data.buffer], { type: 'video/webm' });
  } catch (e) {
    // Clean up on error
    try { await convertFFmpeg.deleteFile(inputName); } catch {}
    try { await convertFFmpeg.deleteFile(outputName); } catch {}

    const errorMsg = lastError || e?.message || e;
    console.error('Conversion error details:', errorMsg);
    throw new Error('Conversion failed: ' + errorMsg);
  } finally {
    // Terminate the FFmpeg instance to free memory
    try {
      console.log('[CONVERT] Terminating FFmpeg instance...');
      await convertFFmpeg.terminate();
      console.log('[CONVERT] FFmpeg instance terminated');
    } catch (e) {
      console.warn('[CONVERT] Failed to terminate FFmpeg instance:', e);
    }
  }
}

/**
 * Mux the original video's audio track into the processed video.
 * Returns a Blob of webm with video+audio. If no audio is present or
 * muxing fails, it throws (caller can catch and fallback).
 *
 * Creates a fresh FFmpeg instance to avoid corruption from previous operations.
 */
async function muxOriginalAudioIntoProcessed(processedVideoBlob, originalVideoSrc) {
  console.log('[MUX] Creating fresh FFmpeg instance for audio muxing...');

  // Create a fresh FFmpeg instance for muxing to avoid state corruption
  const { FFmpeg } = FFmpegWASM;
  const muxFFmpeg = new FFmpeg();

  console.log('[MUX] FFmpeg instance created');

  let lastError = null;
  muxFFmpeg.on('log', ({ type, message }) => {
    // Filter out "Aborted()" message from terminate() - it's expected and harmless
    if (message.includes('Aborted()')) return;

    // Filter out frame-by-frame progress logs (e.g., "frame= 123 fps=...")
    if (message.includes('frame=') && message.includes('fps=')) return;

    // Filter out "size=" progress logs (e.g., "size= 0kB time=...")
    if (message.includes('size=') && message.includes('time=') && message.includes('bitrate=')) return;

    if (type === 'fferr') {
      lastError = message;
      console.error('FFmpeg (mux) ERROR:', message);
    } else {
      console.log('FFmpeg (mux):', message);
    }
  });

  const baseURL =
    window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');

  console.log('[MUX] Loading FFmpeg WASM modules...');

  // Load FFmpeg WASM
  await muxFFmpeg.load({
    coreURL: baseURL + '/ffmpeg/ffmpeg-core.js',
    wasmURL: baseURL + '/ffmpeg/ffmpeg-core.wasm',
    workerURL: baseURL + '/ffmpeg/814.ffmpeg.js'
  });

  console.log('[MUX] FFmpeg WASM loaded successfully');

  // Detect original video format from data URL to use correct file extension
  let originalExtension = '.webm'; // Default to webm (converted videos)
  if (originalVideoSrc.startsWith('data:')) {
    const mimeMatch = originalVideoSrc.match(/^data:(.*?);/);
    if (mimeMatch) {
      const mimeType = mimeMatch[1];
      if (mimeType.includes('mp4')) {
        originalExtension = '.mp4';
      } else if (mimeType.includes('quicktime')) {
        originalExtension = '.mov';
      } else if (mimeType.includes('webm')) {
        originalExtension = '.webm';
      }
      console.log(`[MUX] Detected original format: ${mimeType} -> ${originalExtension}`);
    }
  }

  // Define file names upfront so they're available in catch block for cleanup
  const inProcessed = 'processed.webm';
  const inOriginal = 'original' + originalExtension;  // Use proper extension for format detection
  const extractedAudio = 'audio.webm';  // Output audio as webm
  const outName = 'muxed.webm';

  try {
    console.log('[MUX] Starting audio muxing - gathering file information...');

    // Defensively delete any existing files from filesystem (in case of previous errors)
    try { await muxFFmpeg.deleteFile(inProcessed); } catch {}
    try { await muxFFmpeg.deleteFile(inOriginal); } catch {}
    try { await muxFFmpeg.deleteFile(extractedAudio); } catch {}
    try { await muxFFmpeg.deleteFile(outName); } catch {}

    let processedBytes = await uint8FromBlob(processedVideoBlob);
    const processedSizeMB = processedBytes.length / 1024 / 1024;
    console.log(`[MUX] Processed video size: ${processedSizeMB.toFixed(2)} MB (${processedBytes.length} bytes)`);

    let origBytes = await fetchBytesFromSrc(originalVideoSrc);
    const originalSizeMB = origBytes.length / 1024 / 1024;
    console.log(`[MUX] Original video size: ${originalSizeMB.toFixed(2)} MB (${origBytes.length} bytes)`);
    console.log(`[MUX] Total memory in JS: ${(processedSizeMB + originalSizeMB).toFixed(2)} MB`);

    // FFmpeg.wasm has memory limits due to 32-bit WASM architecture
    // We use a two-step approach: extract audio first (tiny), then mux
    // This allows much larger videos since we only hold processed + audio (not processed + original)
    const MAX_PROCESSED_SIZE_MB = 20; // Limit for processed video
    const MAX_ORIGINAL_SIZE_MB = 30;  // Limit for original (only held temporarily during extraction)

    if (processedSizeMB > MAX_PROCESSED_SIZE_MB) {
      throw new Error(`Processed video too large for audio muxing (${processedSizeMB.toFixed(2)} MB > ${MAX_PROCESSED_SIZE_MB} MB). Try a shorter clip or lower resolution.`);
    }

    if (originalSizeMB > MAX_ORIGINAL_SIZE_MB) {
      throw new Error(`Original video too large for audio extraction (${originalSizeMB.toFixed(2)} MB > ${MAX_ORIGINAL_SIZE_MB} MB). Try a shorter clip.`);
    }

    console.log(`[MUX] Memory overhead acceptable for two-step muxing (processed: ${processedSizeMB.toFixed(2)} MB, original: ${originalSizeMB.toFixed(2)} MB)`);

    console.log('[MUX] Step 1: Extracting audio from original video...');
    console.log(`[MUX] About to write ${originalSizeMB.toFixed(2)} MB to FFmpeg WASM filesystem...`);
    console.log(`[MUX] Byte array type: ${origBytes.constructor.name}, length: ${origBytes.length}`);

    // STEP 1: Load ONLY original video, extract audio, then delete it
    // This prevents having both videos in memory at the same time
    try {
      console.log(`[MUX] Calling muxFFmpeg.writeFile('${inOriginal}', Uint8Array[${origBytes.length}])...`);
      await muxFFmpeg.writeFile(inOriginal, origBytes);
      console.log('[MUX] Successfully wrote original video to FFmpeg filesystem');
    } catch (writeError) {
      console.error('[MUX] Failed to write file to FFmpeg:', writeError);
      console.error('Error stack:', writeError.stack);
      console.error('Error type:', writeError.constructor.name);

      // Log memory state if available
      if (typeof performance !== 'undefined' && performance.memory) {
        console.error('Memory at failure:', {
          usedJSHeapSize: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
          totalJSHeapSize: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
          jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB'
        });
      }

      throw new Error(`Failed to load video into FFmpeg: ${writeError.message || writeError}. Video may be too large for browser WASM memory limits.`);
    }

    // Release the original bytes from JS memory
    origBytes = null;

    // Extract audio only from original (much smaller, saves memory)
    // Transcode to opus for WebM compatibility (MP4 uses AAC which WebM doesn't support)
    try {
      await muxFFmpeg.exec([
        '-i', inOriginal,
        '-vn',                // No video
        '-c:a', 'libopus',    // Transcode to opus (WebM-compatible, works for all source formats)
        '-b:a', '128k',       // Audio bitrate
        extractedAudio
      ]);
      console.log('Audio extraction successful');

      // Check extracted audio size
      const audioData = await muxFFmpeg.readFile(extractedAudio);
      console.log(`Extracted audio size: ${(audioData.length / 1024).toFixed(2)} KB`);
    } catch (extractError) {
      console.error('Audio extraction failed:', extractError);
      const errorMsg = extractError.message || String(extractError);

      // Provide helpful message for memory errors
      if (errorMsg.includes('out of bounds') || errorMsg.includes('out of memory')) {
        throw new Error(`Audio extraction failed due to memory constraints. Try a shorter video (< 3 seconds) or lower resolution.`);
      }

      throw new Error(`Audio extraction failed: ${errorMsg}`);
    }

    // Clean up original full video from FFmpeg memory BEFORE loading processed video
    console.log('Step 2: Freeing memory (deleting original from FFmpeg)...');
    await muxFFmpeg.deleteFile(inOriginal);

    // Force garbage collection hint (if available in dev mode)
    // Note: Requires Chrome with --js-flags="--expose-gc"
    if (typeof gc === 'function') {
      console.log('Requesting garbage collection...');
      gc();
    }

    // STEP 2: Now load processed video and mux with the small extracted audio
    console.log('Step 3: Loading processed video into FFmpeg...');
    await muxFFmpeg.writeFile(inProcessed, processedBytes);

    // Release processed bytes from JS memory
    processedBytes = null;

    console.log('Step 4: Muxing audio into processed video...');

    // Mux extracted audio with processed video
    try {
      await muxFFmpeg.exec([
        '-i', inProcessed,
        '-i', extractedAudio,
        '-c:v', 'copy',       // Copy video without re-encoding
        '-c:a', 'copy',       // Copy audio without re-encoding (already opus)
        '-shortest',          // Match shortest stream duration
        '-avoid_negative_ts', 'make_zero',
        '-fflags', '+genpts',
        outName
      ]);
    } catch (muxError) {
      console.error('Audio muxing failed:', muxError);
      const errorMsg = muxError.message || String(muxError);

      // Provide helpful message for memory errors
      if (errorMsg.includes('out of bounds') || errorMsg.includes('out of memory')) {
        throw new Error(`Audio muxing failed due to memory constraints. Try a shorter video (< 3 seconds) or lower resolution.`);
      }

      throw new Error(`Audio muxing failed: ${errorMsg}`);
    }

    const outData = await muxFFmpeg.readFile(outName);

    // Clean up
    try { await muxFFmpeg.deleteFile(inProcessed); } catch {}
    try { await muxFFmpeg.deleteFile(inOriginal); } catch {}
    try { await muxFFmpeg.deleteFile(extractedAudio); } catch {}
    try { await muxFFmpeg.deleteFile(outName); } catch {}

    console.log('Audio muxing complete!');
    return new Blob([outData.buffer], { type: 'video/webm' });
  } catch (e) {
    // Clean up on error
    try { await muxFFmpeg.deleteFile(inProcessed); } catch {}
    try { await muxFFmpeg.deleteFile(inOriginal); } catch {}
    try { await muxFFmpeg.deleteFile(extractedAudio); } catch {}
    try { await muxFFmpeg.deleteFile(outName); } catch {}

    const errorMsg = lastError || e?.message || e;
    console.error('Mux error details:', errorMsg);
    throw new Error('Mux failed: ' + errorMsg);
  } finally {
    // Terminate the mux FFmpeg instance to free memory
    try {
      console.log('[MUX] Terminating FFmpeg instance...');
      await muxFFmpeg.terminate();
      console.log('[MUX] FFmpeg instance terminated');
    } catch (e) {
      console.warn('[MUX] Failed to terminate FFmpeg instance:', e);
    }
  }
}
