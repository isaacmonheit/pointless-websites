// Define global variables to store the slider values and seed
let pixelationValue = 10;
let mixRatioValue = 0.5;
let brightnessValue = 128;
let currentSeed = 0;
let useFixedSeed = false;
let currentImageSrc = null;

// A simple seedable random number generator
function seededRandom(seed) {
  var x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateSubduedColor(seed, index) {
  const mixRatio = mixRatioValue;
  const baseSeed = seed;
  const rnd1 = seededRandom(baseSeed + index);
  const rnd2 = seededRandom(baseSeed + index + 256);
  const rnd3 = seededRandom(baseSeed + index + 512);

  return [
    Math.floor((rnd1 * 256 * (1 - mixRatio)) + (brightnessValue * mixRatio)),
    Math.floor((rnd2 * 256 * (1 - mixRatio)) + (brightnessValue * mixRatio)),
    Math.floor((rnd3 * 256 * (1 - mixRatio)) + (brightnessValue * mixRatio))
  ];
}

function generateRandomSeed() {
  return Math.floor(Math.random() * 10000);
}

function getRandomPalette() {
  const palette = [];
  console.log(useFixedSeed);
  let seed = useFixedSeed ? currentSeed : generateRandomSeed();
  console.log(seed);
  for (let i = 0; i < 256; i++) {
    palette.push(generateSubduedColor(seed, i));
  }
  if (!useFixedSeed) {
    currentSeed = seed; // Update the current seed
    document.getElementById('seedInput').value = currentSeed;
  }
  return palette;
}











/// PIXELATION BELOW COLOR GENERATION ABOVE

function pixelateImage(context, image) {
    const scaledWidth = image.width / pixelationValue;
    const scaledHeight = image.height / pixelationValue;
  
    // Draw the scaled-down image
    context.drawImage(image, 0, 0, scaledWidth, scaledHeight);
  
    // Now scale the image back up to its original size, causing pixelation
    context.mozImageSmoothingEnabled = false;
    context.webkitImageSmoothingEnabled = false;
    context.imageSmoothingEnabled = false; // Future-proof
    context.drawImage(context.canvas, 0, 0, scaledWidth, scaledHeight, 0, 0, context.canvas.width, context.canvas.height);
  }



  ///////////////// START OF IDEA #1 FOR COLORS /////////////////

//   function getRandomPalette() {
//     const palette = [];
//     for (let i = 0; i < 256; i++) { // Generate 256 random colors
//       palette.push([Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)]);
//     }
//     return palette;
//   }
  
  function matchToPalette(originalColor, palette) {
    // A simple way to find a matching color from the palette by comparing brightness
    const originalBrightness = (originalColor[0] + originalColor[1] + originalColor[2]) / 3;
    let closestMatch = palette[0];
    let smallestDifference = Number.MAX_VALUE;
  
    for (const color of palette) {
      const colorBrightness = (color[0] + color[1] + color[2]) / 3;
      const difference = Math.abs(originalBrightness - colorBrightness);
  
      if (difference < smallestDifference) {
        smallestDifference = difference;
        closestMatch = color;
      }
    }
    return closestMatch;
  }
  
  function replaceColors(imageData) {
    const palette = getRandomPalette();
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const originalColor = [imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]];
      const newColor = matchToPalette(originalColor, palette);
      
      imageData.data[i] = newColor[0];
      imageData.data[i + 1] = newColor[1];
      imageData.data[i + 2] = newColor[2];
    }
    return imageData;
  }

  ///////////////// END OF IDEA #1 FOR COLORS /////////////////


  ///////////////// IDEA #2, SUBDUED COLORS /////////////////////

  // function generateSubduedColor() {
  //   // Generate a random RGB color and mix it with gray (128, 128, 128) to subdue it
  //   const baseColor = [brightnessValue, brightnessValue, brightnessValue]; // Gray
  //   const mixRatio = mixRatioValue; // Adjust this to make colors more or less subdued
  //   return [
  //     Math.floor((Math.random() * 256 * (1 - mixRatio)) + (baseColor[0] * (mixRatio))),
  //     Math.floor((Math.random() * 256 * (1 - mixRatio)) + (baseColor[1] * (mixRatio))),
  //     Math.floor((Math.random() * 256 * (1 - mixRatio)) + (baseColor[2] * (mixRatio)))
  //   ];
  // }
  
  // function getRandomPalette() {
  //   const palette = [];
  //   for (let i = 0; i < 256; i++) { // Generate 256 subdued colors
  //     palette.push(generateSubduedColor());
  //   }
  //   return palette;
  // }

    ///////////////// END OF IDEA #2, SUBDUED COLORS /////////////////////


  ///////////////// IDEA #3, GREYSCALE /////////////////////

function convertToGrayscale(imageData) {
    for (let i = 0; i < imageData.data.length; i += 4) {
        // Calculate the perceived brightness of the color.
        const brightness = 0.3 * imageData.data[i] + 0.59 * imageData.data[i + 1] + 0.11 * imageData.data[i + 2];
    
        // Apply the brightness to each RGB channel to convert to grayscale.
        imageData.data[i] = brightness;     // Red channel
        imageData.data[i + 1] = brightness; // Green channel
        imageData.data[i + 2] = brightness; // Blue channel
    }
    return imageData;
    }


    // Add event listeners to update global variables when sliders change
    document.getElementById('pixelationRange').addEventListener('change', debounce(function(event) {
      pixelationValue = parseInt(event.target.value);
      if (currentImageSrc) {
        processImage(currentImageSrc);
      }
    }, 1));
    
    document.getElementById('mixRatioRange').addEventListener('change', debounce(function(event) {
      mixRatioValue = parseFloat(event.target.value);
      if (currentImageSrc) {
        processImage(currentImageSrc);
      }
    }, 1));
    
    document.getElementById('brightnessRange').addEventListener('change', debounce(function(event) {
      brightnessValue = parseInt(event.target.value);
      if (currentImageSrc) {
        processImage(currentImageSrc);
      }
    }, 1));

    // Event listener for seed input and checkbox
    document.getElementById('seedInput').addEventListener('change', debounce(function(event) {
      currentSeed = parseInt(event.target.value);
      if (currentImageSrc) {
        processImage(currentImageSrc);
      }
    }, 1));

    document.getElementById('useFixedSeed').addEventListener('change', function(event) {
      useFixedSeed = event.target.checked;
      if (currentImageSrc) {
        processImage(currentImageSrc);
      }
    });

// This function will handle the image processing
function processImage(imgSrc) {
  const img = new Image();
  img.onload = function() {
    // Create a temporary canvas to resize the image
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    const maxDimension = 800; // Maximum size of the smaller image
    tempCanvas.width = (img.width > img.height) ? maxDimension : (img.width / img.height) * maxDimension;
    tempCanvas.height = (img.height > img.width) ? maxDimension : (img.height / img.width) * maxDimension;
    tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);

    // Get the canvas and context for actual processing
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = tempCanvas.width;
    canvas.height = tempCanvas.height;
    ctx.drawImage(tempCanvas, 0, 0); // Draw the resized image onto the main canvas

    // Apply pixelation and color replacement
    pixelateImage(ctx, img);
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    imageData = replaceColors(imageData);

    // Put the processed image data back onto the canvas
    ctx.putImageData(imageData, 0, 0);
  };
  img.src = imgSrc;
}


  // Add this inside your file input's change event listener
// function createSmallImage(src) {
//   const img = new Image();
//   img.onload = function() {
//     const canvas = document.createElement('canvas');
//     const ctx = canvas.getContext('2d');
//     const maxDimension = 800; // Maximum size of the smaller image
//     canvas.width = (img.width > img.height) ? maxDimension : (img.width / img.height) * maxDimension;
//     canvas.height = (img.height > img.width) ? maxDimension : (img.height / img.width) * maxDimension;
//     ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
//     processImage.imgSrc = canvas.toDataURL(); // Use the resized image for processing
//     processImage();
//   };
//   img.src = src;
// }

document.getElementById('imageUpload').addEventListener('change', function(event) {
  if (event.target.files && event.target.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      currentImageSrc = e.target.result;
      processImage(currentImageSrc);
    };
    reader.readAsDataURL(event.target.files[0]);
  }
});


// good for waiting for input changes, use in addEventListener
function debounce(func, delay) {
  let debounceTimer;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(context, args), delay);
  };
}

// Add this in your JavaScript
document.getElementById('downloadBtn').addEventListener('click', function() {
  const canvas = document.getElementById('canvas');
  const img = document.createElement('a');
  img.href = canvas.toDataURL('image/png');
  img.download = 'i-love-this-image.png';
  img.click();
});


//////EXPONENTIALIZE
let offScreenCanvas = document.createElement('canvas');
let offScreenCtx = offScreenCanvas.getContext('2d');

function exponentializeImage() {
  const canvas = document.getElementById('canvas');
  offScreenCanvas.width = canvas.width;
  offScreenCanvas.height = canvas.height;

  // Draw the current image onto the off-screen canvas
  offScreenCtx.drawImage(canvas, 0, 0);

  // Set pixelationValue to 0 and update the slider
  pixelationValue = 0;
  document.getElementById('pixelationRange').value = pixelationValue;

  // Apply the blur effect on the off-screen canvas
  const blurValue = 5; // Adjust as needed
  offScreenCtx.filter = 'blur(' + blurValue + 'px)';
  offScreenCtx.drawImage(offScreenCanvas, 0, 0);
  offScreenCtx.filter = 'none';

  processImage(currentImageSrc);


  // Now apply the pixelation and other effects on the blurred image
  currentImageSrc = offScreenCanvas.toDataURL('image/png');
}

document.getElementById('exponentializeBtn').addEventListener('click', exponentializeImage);

//////SHIFT IMAGE
let shiftInterval;
let isShifting = false;

function toggleShift() {
  if (isShifting) {
    clearInterval(shiftInterval); // Stop the interval
    isShifting = false;
  } else {
    const shiftSpeed = 5200 - document.getElementById('shiftSpeedSlider').value;
    shiftInterval = setInterval(shiftImage, shiftSpeed); // Use the slider value
    isShifting = true;
  }
}

document.getElementById('shiftSpeedSlider').addEventListener('input', function() {
  if (isShifting) {
    clearInterval(shiftInterval);
    const shiftSpeed = 5200 - document.getElementById('shiftSpeedSlider').value;
    shiftInterval = setInterval(shiftImage, shiftSpeed);
  }
});


function shiftImage() {
  offScreenCanvas.width = canvas.width;
  offScreenCanvas.height = canvas.height;
  offScreenCtx.drawImage(canvas, 0, 0); // Copy current image to off-screen canvas

  const img = new Image();
  img.onload = function() {
    offScreenCtx.drawImage(img, 0, 0);
    pixelateImage(offScreenCtx, img);
    let imageData = offScreenCtx.getImageData(0, 0, offScreenCanvas.width, offScreenCanvas.height);
    imageData = replaceColors(imageData);
    offScreenCtx.putImageData(imageData, 0, 0);

    // Update the main canvas after processing
    const mainCanvas = document.getElementById('canvas');
    const mainCtx = mainCanvas.getContext('2d');
    mainCanvas.width = offScreenCanvas.width;
    mainCanvas.height = offScreenCanvas.height;
    mainCtx.drawImage(offScreenCanvas, 0, 0);
  };
  img.src = canvas.toDataURL('image/png');
}

document.getElementById('shiftBtn').addEventListener('click', toggleShift);

