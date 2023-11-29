// Define global variables to store the slider values
let pixelationValue = 10;
let mixRatioValue = 0.5;
let brightnessValue = 128;

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

  function generateSubduedColor() {
    // Generate a random RGB color and mix it with gray (128, 128, 128) to subdue it
    const baseColor = [brightnessValue, brightnessValue, brightnessValue]; // Gray
    const mixRatio = mixRatioValue; // Adjust this to make colors more or less subdued
    return [
      Math.floor((Math.random() * 256 * mixRatio) + (baseColor[0] * (1 - mixRatio))),
      Math.floor((Math.random() * 256 * mixRatio) + (baseColor[1] * (1 - mixRatio))),
      Math.floor((Math.random() * 256 * mixRatio) + (baseColor[2] * (1 - mixRatio)))
    ];
  }
  
  function getRandomPalette() {
    const palette = [];
    for (let i = 0; i < 256; i++) { // Generate 256 subdued colors
      palette.push(generateSubduedColor());
    }
    return palette;
  }

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
  document.getElementById('pixelationRange').addEventListener('change', function(event) {
    pixelationValue = parseInt(event.target.value);
    processImage();
  });
  
  document.getElementById('mixRatioRange').addEventListener('change', function(event) {
    mixRatioValue = parseFloat(event.target.value);
    processImage();
  });
  
  document.getElementById('brightnessRange').addEventListener('change', function(event) {
    brightnessValue = parseInt(event.target.value);
    processImage();
  });

// This function will handle the image processing
function processImage() {
    // Create a new Image object
    const img = new Image();
    img.onload = function() {
      // Get the canvas and context
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      // Set canvas size to image size
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw the uploaded image onto the canvas
      ctx.drawImage(img, 0, 0);
      
      // Apply pixelation and color replacement
      pixelateImage(ctx, img);
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      imageData = replaceColors(imageData);
      
      // Put the processed image data back onto the canvas
      ctx.putImageData(imageData, 0, 0);
      
      // Display the canvas
      canvas.style.display = 'block';
    };
    
    // Use the stored image source
    img.src = processImage.imgSrc;
  }
  
  // This event listener is attached to the file input
  document.getElementById('imageUpload').addEventListener('change', function(event) {
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      reader.onload = function(e) {
        // Store the image source and process the image
        processImage.imgSrc = e.target.result;
        processImage();
      };
      reader.readAsDataURL(event.target.files[0]);
    }
  });
  
  // You can assign a default image here
//   processImage.imgSrc = 'IMG_1223.jpg';
//   processImage(); // Uncomment these lines if you have a default image to load initially
  