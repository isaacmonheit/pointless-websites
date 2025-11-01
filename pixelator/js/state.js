// ============================================================================
// STATE VARIABLES
// ============================================================================

let pixelationValue = 10;
let saturationValue = 0.5;
let brightnessValue = 128;
let contrastValue = 1.0;
let currentSeed = 0;
let useFixedSeed = false;
let currentImageSrc = null;
let originalImageSrc = null;
let shiftInterval = null;
let isShifting = false;

// Store the pixelated intermediate (before color replacement) for fast shifting
let pixelatedIntermediate = null;

// Video-related state
let isVideoMode = false;
let currentVideoSrc = null;
let videoFrames = [];
let previewInterval = null;
let isPreviewing = false;
let processedVideoBlob = null;

// FFmpeg state
let ffmpeg = null;
let ffmpegLoaded = false;

// Off-screen canvases for image processing (reused to avoid allocation overhead)
let offScreenCanvas = document.createElement('canvas');
let offScreenCtx = offScreenCanvas.getContext('2d', { willReadFrequently: true });
let tempCanvas = document.createElement('canvas');
let tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

// Download URLs (revoked when replaced/unload)
let imageDownloadUrl = null;
let videoDownloadUrl = null;
