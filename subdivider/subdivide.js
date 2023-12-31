document.addEventListener('DOMContentLoaded', function () {
  const sequencerContainer = document.getElementById('sequencer-container');
  const stepsInput = document.getElementById('steps');

  ////////////////////// MOUSE DOWN DRAG FUNCTION /////////////////////


  let isMouseDown = false; // Track the state of the mouse button

  function toggleCircle(circle) {
    circle.classList.toggle('active');
    if (circle.classList.contains('active')) {
      playSound(sound1);
    }
  }
  

  // Function to update the sequencer
  // Function to update the sequencer
  function updateSequencer(steps) {
    sequencerContainer.innerHTML = ''; // Clear existing circles
    for (let i = 0; i < steps; i++) {
      const circle = document.createElement('div');
      circle.dataset.step = i; // Add a data attribute to identify the step
      circle.classList.add('circle');

      // Create a label for the circle
      const label = document.createElement('div');
      label.classList.add('circle-label');
      label.textContent = (i + 1).toString(); // Label numbers start from 1

      // Handle mousedown event
      circle.addEventListener('mousedown', function (event) {
        isMouseDown = true;
        toggleCircle(circle);
        event.preventDefault(); // Prevent default text selection
      });

      // Handle mouseenter event
      circle.addEventListener('mouseenter', function () {
        if (isMouseDown) {
          toggleCircle(circle);
        }
      });

      // Append the label to the circle
      circle.appendChild(label);

      // Add the circle to the container
      sequencerContainer.appendChild(circle);
    }
  }


  // ... (other existing code)

  // Handle mouseup event for the whole document
  document.addEventListener('mouseup', function () {
    isMouseDown = false;
  });


  // Event listener for changing steps
  stepsInput.addEventListener('input', function () {
    updateSequencer(this.value);
    if (isPlaying) {
      // If the sequencer is playing, reset to ensure proper operation
      stopSequencer();
      startSequencer();
    }
  });

  // Initial update
  updateSequencer(stepsInput.value);

  // Add play button functionality
  const playButton = document.getElementById('play-button');
  playButton.addEventListener('click', function () {
    if (isPlaying) {
      stopSequencer();
      playButton.textContent = 'Play'; // Update button text to "Play"
    } else {
      startSequencer();
      playButton.textContent = 'Stop'; // Update button text to "Stop"
    }
  });

  // Global variables for sequencer state
  let currentStep = 0;
  let isPlaying = false;
  let bpm = 120; // You can change this value or make it dynamic
  let intervalId = null;

  // Function to stop the sequencer
  function stopSequencer() {
    if (intervalId) {
      clearInterval(intervalId);
    }
    isPlaying = false;
    currentStep = 0; // Reset to first step
    // Do not call updateActiveStep() here, or conditionally check if the sequencer is playing before playing sound2
    const circles = sequencerContainer.querySelectorAll('.circle');
    circles.forEach(circle => circle.classList.remove('current')); // Remove 'current' class from all circles
  }

  /////////////////////////// BPM STUFF ////////////////////////////////////

  // Add a new global variable for the BPM input
  const bpmInput = document.getElementById('bpm');

  // Modify the startSequencer function to use the current BPM value
  function startSequencer() {
    bpm = parseInt(bpmInput.value); // Ensure bpm is an integer
    const intervalTime = ((60 / bpm) * 1000 / 4); // Convert BPM to milliseconds
    isPlaying = true;
    
    // Clear any existing intervals before setting a new one
    if (intervalId) {
      clearInterval(intervalId);
    }

    intervalId = setInterval(() => {
      updateActiveStep();
      currentStep = (currentStep + 1) % sequencerContainer.querySelectorAll('.circle').length; // Loop back to first step
    }, intervalTime);
  }

  // Add event listener for BPM changes
  bpmInput.addEventListener('input', function () {
    if (isPlaying) {
      // If the sequencer is playing, restart it with the new BPM
      stopSequencer();
      startSequencer();
    }
  });




////////////////////// SOUNDS /////////////////////


  // Create audio objects
  const sound1 = new Audio('/subdivider/sounds/click.wav');
  const sound2 = new Audio('/subdivider/sounds/snap1.wav');
  const sound3 = new Audio('/subdivider/sounds/shaker_guilty2.mp3'); // Adjust the path as necessary
  sound3.volume = 0.1; // Set volume to a lower level, e.g., 50%

  sound1.preload = 'auto';
  sound2.preload = 'auto';
  sound3.preload = 'auto';

  // Function to play a sound
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // Function to load and decode an audio file
  function loadSound(url) {
    return fetch(url)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer));
  }

  // Function to play a sound
  function playSound(buffer, time = audioContext.currentTime, gainValue = 1.0) {
    const gainNode = audioContext.createGain();
    gainNode.gain.value = gainValue;
  
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode).connect(audioContext.destination);
    source.start(time); // Schedule the start
  }

   // Load your sounds
   let sound1Buffer, sound2Buffer, sound3Buffer;
   loadSound('/subdivider/sounds/click.wav').then(buffer => sound1Buffer = buffer);
   loadSound('/subdivider/sounds/snap1.wav').then(buffer => sound2Buffer = buffer);
   loadSound('/subdivider/sounds/shaker_guilty2.mp3').then(buffer => sound3Buffer = buffer);
 
   // ... (rest of your existing code)
 
   // Update your existing playSound call with playSound function using buffers
   // For example, in updateActiveStep(), replace playSound(sound1) with playSound(sound1Buffer)
 
   // Function to update the active step
   function updateActiveStep() {
     const circles = sequencerContainer.querySelectorAll('.circle');
     circles.forEach((circle, index) => {
       if (index === currentStep) {
         circle.classList.add('current');
         playSound(sound3Buffer, 0.1); // Play sound3 on every beat
 
         if (index === 0 && isPlaying) { // Check if it's the first beat and the sequencer is playing
           playSound(sound2Buffer);
         }
         if (circle.classList.contains('active')) {
           playSound(sound1Buffer);
         }
       } else {
         circle.classList.remove('current');
       }
     });
   }

});