// ============================================================================
// UTILITIES
// ============================================================================

function stopAllActivity() {
  if (isShifting) {
    clearInterval(shiftInterval);
    isShifting = false;
    const shiftBtn = document.getElementById('shiftBtn');
    if (shiftBtn) {
      shiftBtn.classList.remove('active');
      shiftBtn.textContent = 'Shift';
    }
  }
  if (isPreviewing) {
    clearInterval(previewInterval);
    isPreviewing = false;
    const previewBtn = document.getElementById('previewFramesBtn');
    if (previewBtn) {
      previewBtn.classList.remove('active');
      previewBtn.textContent = 'Preview First 15 Frames';
    }
  }

  // Clean up intermediate frames and data
  cleanupIntermediateFrames();
}

function cleanupIntermediateFrames() {
  // Clear video frames
  if (videoFrames && videoFrames.length > 0) {
    videoFrames.forEach(frame => {
      if (frame && frame.imageData) {
        frame.imageData = null;
      }
    });
    videoFrames = [];
  }

  // Clear pixelated intermediate used in shift mode
  pixelatedIntermediate = null;

  // Clear off-screen canvases
  if (offScreenCanvas) {
    offScreenCtx.clearRect(0, 0, offScreenCanvas.width, offScreenCanvas.height);
    offScreenCanvas.width = 0;
    offScreenCanvas.height = 0;
  }
  if (tempCanvas) {
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCanvas.width = 0;
    tempCanvas.height = 0;
  }
}

function revokeUrl(url) {
  if (url) URL.revokeObjectURL(url);
}

window.addEventListener('beforeunload', () => {
  revokeUrl(imageDownloadUrl);
  revokeUrl(videoDownloadUrl);
  const vp = document.getElementById('videoPlayer');
  if (vp && vp.dataset && vp.dataset.objUrl) {
    URL.revokeObjectURL(vp.dataset.objUrl);
  }
  // Clean up currentVideoSrc if it's a blob URL
  if (currentVideoSrc && currentVideoSrc.startsWith('blob:')) {
    URL.revokeObjectURL(currentVideoSrc);
  }
});

// Reuse a helper to download without blocking
function downloadBlob(blob, filename) {
  if (!blob || !blob.size) {
    alert('Nothing to download yet.');
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  requestAnimationFrame(() => {
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  });
}

/**
 * Simple seedable random number generator
 * @param {number} seed
 * @returns {number} [0,1)
 */
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Deterministic per-frame seed from pixels
 */
function generateDeterministicSeed(previousSeed, frameData) {
  if (useFixedSeed) return currentSeed;
  const data = frameData.data;
  let hash = previousSeed;
  for (let i = 0; i < data.length; i += 4000) {
    hash = ((hash << 5) - hash + data[i]) | 0;
    hash = ((hash << 5) - hash + data[i + 1]) | 0;
    hash = ((hash << 5) - hash + data[i + 2]) | 0;
  }
  return Math.abs(hash) % 10000;
}

function generateRandomSeed() {
  return Math.floor(Math.random() * 10000);
}

function debounce(func, delay) {
  let debounceTimer;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(context, args), delay);
  };
}

// ---- Audio mux helpers -----------------------------------------------------
function arrayBufferFromBlob(blob) {
  return blob.arrayBuffer();
}

async function uint8FromBlob(blob) {
  return new Uint8Array(await arrayBufferFromBlob(blob));
}

// Fetch bytes from a data: URL, blob: URL, or http(s) URL
async function fetchBytesFromSrc(src) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to fetch source media: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}
