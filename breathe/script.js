const container = document.getElementById('animation-container');

// Configuration
const snowflakeCount = 100;
const minSize = 5;
const maxSize = 60;
const speed = 0.2; 
timePerCycle = 5000;
const biasTowardsSmall = 5 //larger = more smaller ones

// Generate snowflakes
for (let i = 0; i < snowflakeCount; i++) {
    const snowflake = document.createElement('div');
    const randomBias = Math.pow(Math.random(), biasTowardsSmall);  // This biases towards smaller values
    const size = minSize + randomBias * (maxSize - minSize);
    snowflake.style.width = `${size}px`;
    snowflake.style.height = `${size}px`;
    snowflake.style.background = 'rgba(255, 255, 255, 0.5)';
    snowflake.style.borderRadius = '50%';
    snowflake.style.position = 'absolute';
    snowflake.style.left = `${Math.random() * 100}vw`;
    snowflake.style.top = `${Math.random() * 100}vh`;
    container.appendChild(snowflake);
}

let direction = 'up';
let lastTime = null;
let elapsedTime = 0;

function animateSnowflakes(timestamp) {
    if (!lastTime) lastTime = timestamp;

    // Calculate the time difference between the current and the last frame
    let deltaTime = timestamp - lastTime;
    
    // Cap deltaTime to avoid large jumps
    const maxDeltaTime = 100;  // 100ms or 0.1 seconds
    deltaTime = Math.min(deltaTime, maxDeltaTime);
    
    lastTime = timestamp;  // Update lastTime for the next frame
    
    elapsedTime += deltaTime;
    
    // Reset elapsedTime for a full cycle (2 * timePerCycle to account for up and down)
    if (elapsedTime > 2 * timePerCycle) {
        elapsedTime = 0;
    }
    // Calculate the sine value based on elapsedTime
    const rawSineValue = Math.sin((Math.PI * elapsedTime) / timePerCycle);

    // Modify the sine value using a power function to create the plateau effect at the peaks
    const modifiedSineValue = Math.sign(rawSineValue) * Math.pow(Math.abs(rawSineValue), 2.1);

    const snowflakes = document.querySelectorAll('#animation-container div');
    snowflakes.forEach(snowflake => {
        const top = parseFloat(snowflake.style.top);
        
        // Calculate the relative size of the snowflake (between 0 and 1)
        const size = parseFloat(snowflake.style.width);
        const relativeSize = Math.pow(size / maxSize, 1); 

        // Adjust the movement based on the size
        const adjustedSpeed = speed * relativeSize;
        let newTop = top - adjustedSpeed * deltaTime * modifiedSineValue;

        // Adjust the shape of the snowflake based on the sine value
        const scaleXValue = Math.max(0.1, 1 - Math.abs(modifiedSineValue));
        const scaleYValue = 1 + Math.abs(modifiedSineValue);
        snowflake.style.transform = `scaleX(${scaleXValue}) scaleY(${scaleYValue})`;

        // Adjust wrapping check to consider the size of the snowflake
        const offScreenTop = -size / window.innerHeight * 100; // Convert pixel size to vh unit
        const offScreenBottom = 100 + size / window.innerHeight * 100;

        if (newTop < offScreenTop) newTop = offScreenBottom;
        if (newTop > offScreenBottom) newTop = offScreenTop;

        snowflake.style.top = `${newTop}vh`;
    });

    requestAnimationFrame(animateSnowflakes);
}

requestAnimationFrame(animateSnowflakes);

/////////////////////// FULLSCREEN CODE ///////////////////////////

const fullscreenToggle = document.getElementById('fullscreenToggle');

fullscreenToggle.addEventListener('click', function() {
    // Prefixed versions for older browsers
    const requestFullscreen = document.documentElement.requestFullscreen ||
                              document.documentElement.webkitRequestFullscreen || 
                              document.documentElement.mozRequestFullScreen || 
                              document.documentElement.msRequestFullscreen;

    const exitFullscreen = document.exitFullscreen ||
                           document.webkitExitFullscreen || 
                           document.mozCancelFullScreen || 
                           document.msExitFullscreen;

    if (!document.fullscreenElement && 
        !document.webkitFullscreenElement && 
        !document.mozFullScreenElement && 
        !document.msFullscreenElement) {
        requestFullscreen.call(document.documentElement);
        fullscreenToggle.style.display = 'none'; // hide the button in fullscreen mode
    } else {
        exitFullscreen.call(document);
        fullscreenToggle.style.display = 'block'; // show the button when not in fullscreen mode
    }
    updateFullscreenButtonVisibility();
});

function updateFullscreenButtonVisibility() {
    if (document.fullscreenElement || 
        document.webkitFullscreenElement || 
        document.mozFullScreenElement || 
        document.msFullscreenElement) {
        fullscreenToggle.style.display = 'none';
    } else {
        fullscreenToggle.style.display = 'block';
    }
}

// Standard event
document.addEventListener('fullscreenchange', updateFullscreenButtonVisibility);
// Prefixed events for older browsers
document.addEventListener('webkitfullscreenchange', updateFullscreenButtonVisibility);
document.addEventListener('mozfullscreenchange', updateFullscreenButtonVisibility);
document.addEventListener('MSFullscreenChange', updateFullscreenButtonVisibility);

///////////////////////// SLIDER CODE ///////////////////////////

const speedSlider = document.getElementById('speedSlider');
const snailIcon = document.getElementById('snailIcon');
const cheetahIcon = document.getElementById('cheetahIcon');
const iconContainer = document.getElementById('iconContainer');

speedSlider.addEventListener('input', function() {
    console.log('Slider Value:', speedSlider.value);
    timePerCycle = 10000 - parseInt(speedSlider.value);
    console.log('timePerCycle Updated:', timePerCycle);
});

function updateFullscreenButtonVisibility() {
    if (document.fullscreenElement) {
        fullscreenToggle.style.display = 'none';
        speedSlider.style.display = 'none';  // hide the slider in fullscreen mode
        iconContainer.style.display = 'none';  // hide the icons in fullscreen mode
    } else {
        fullscreenToggle.style.display = 'block';
        speedSlider.style.display = 'block';  // show the slider when not in fullscreen mode
        iconContainer.style.display = 'block';  // show the icons when not in fullscreen mode
    }
}

document.addEventListener('fullscreenchange', updateFullscreenButtonVisibility);
