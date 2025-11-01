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
  const { fetchFile } = FFmpegUtil;

  if (!ffmpegLoaded) {
    if (progressCallback) progressCallback('Loading converter...', 0);
    await initFFmpeg();
  }

  if (progressCallback) progressCallback('Converting video...', 10);

  const fileName = file.name;
  const inputName = 'input' + fileName.substring(fileName.lastIndexOf('.'));
  const outputName = 'output.webm';

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  let lastProgress = 10;
  ffmpeg.on('progress', ({ progress }) => {
    const percent = Math.round(progress * 80) + 10; // 10-90%
    if (percent > lastProgress) {
      lastProgress = percent;
      if (progressCallback)
        progressCallback('Converting video...', percent);
    }
  });

  await ffmpeg.exec([
    '-i',
    inputName,
    '-c:v',
    'vp8',
    '-b:v',
    '2M',
    '-c:a',
    'libvorbis',
    '-threads',
    '4',
    outputName
  ]);

  if (progressCallback) progressCallback('Finalizing...', 95);

  const data = await ffmpeg.readFile(outputName);

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  if (progressCallback) progressCallback('Conversion complete!', 100);

  return new Blob([data.buffer], { type: 'video/webm' });
}

/**
 * Mux the original video's audio track into the processed video.
 * Returns a Blob of webm with video+audio. If no audio is present or
 * muxing fails, it throws (caller can catch and fallback).
 */
async function muxOriginalAudioIntoProcessed(processedVideoBlob, originalVideoSrc) {
  if (!ffmpegLoaded) {
    await initFFmpeg();
  }

  const inProcessed = 'processed.webm';
  const inOriginal = 'original_input';
  const outName = 'muxed.webm';

  const processedBytes = await uint8FromBlob(processedVideoBlob);
  await ffmpeg.writeFile(inProcessed, processedBytes);

  const origBytes = await fetchBytesFromSrc(originalVideoSrc);
  await ffmpeg.writeFile(inOriginal, origBytes);

  try {
    await ffmpeg.exec([
      '-i', inProcessed,
      '-i', inOriginal,
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c:v', 'copy',
      '-c:a', 'libopus',
      '-shortest',
      outName
    ]);
  } catch (e) {
    throw new Error('Mux failed (no audio track or codec issue): ' + (e?.message || e));
  }

  const outData = await ffmpeg.readFile(outName);

  try { await ffmpeg.deleteFile(inProcessed); } catch {}
  try { await ffmpeg.deleteFile(inOriginal); } catch {}
  try { await ffmpeg.deleteFile(outName); } catch {}

  return new Blob([outData.buffer], { type: 'video/webm' });
}
