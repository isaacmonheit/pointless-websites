import Essentia from './node_modules/essentia.js/dist/essentia.js-core.es.js';
import { EssentiaWASM } from './node_modules/essentia.js/dist/essentia-wasm.es.js';
// Web Audio API setup
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let hihatBuffer, snareBuffer, kickBuffer;

function loadAudioFile(url, callback) {
    fetch(url)
        .then(response => response.arrayBuffer())
        .then(data => audioContext.decodeAudioData(data, callback));
}

// Load the hi-hat sound
loadAudioFile('/sequencer/sounds/hat2.wav', buffer => {
    hihatBuffer = buffer;
});

// Load the snare sound
loadAudioFile('/sequencer/sounds/snare1.wav', buffer => {
    snareBuffer = buffer;
});

// Load the kick sound
loadAudioFile('/sequencer/sounds/kick1.wav', buffer => {
    kickBuffer = buffer;
});

function playSound(buffer) {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
}

function playInstrument(instrument) {
    switch (instrument) {
        case 'hihat':
            playSound(hihatBuffer);
            break;
        case 'snare':
            playSound(snareBuffer);
            break;
        case 'kick':
            playSound(kickBuffer);
            break;
    }
}

// Your sequencer grid setup
const grid = document.getElementById('sequencerGrid');
const instruments = ['hihat', 'snare', 'kick'];

instruments.forEach(instrument => {
    for (let i = 0; i < 16; i++) {
        const circle = document.createElement('div');
        circle.classList.add('circle', instrument);
        grid.appendChild(circle);
    }
});

const circles = document.querySelectorAll('.circle');
circles.forEach(circle => {
    circle.addEventListener('click', function() {
        this.classList.toggle('active');
    });
});

let currentBeat = 0;

// BPM Updater
const menuIcon = document.getElementById('menuIcon');
const bpmPopup = document.getElementById('bpmPopup');
const bpmInput = document.getElementById('bpmInput');
const tip = document.getElementById('tip');
let sequencerInterval = null;

menuIcon.addEventListener('click', () => {
    bpmPopup.style.display = bpmPopup.style.display === 'none' ? 'block' : 'none';
    tip.style.display = tip.style.display === 'none' ? 'block' : 'none';
});

bpmInput.addEventListener('change', () => {
    const bpm = parseFloat(bpmInput.value);
    if (bpm >= 0 && bpm <= 1000) {
        clearInterval(sequencerInterval);
        sequencerInterval = setInterval(runSequencer, (60 / bpm) * 1000 / 4);  // Divided by 4 for 16th notes
    }
});

// Run Sequencer (this is the same code as before, but now encapsulated in a function)
function runSequencer() {
    // Remove the current indicator from all circles
    circles.forEach(circle => circle.classList.remove('current'));

    // Get circles for the current beat
    const currentBeatCircles = document.querySelectorAll(`.circle:nth-child(16n+${currentBeat+1})`);
    currentBeatCircles.forEach(circle => {
        circle.classList.add('current');
        if (circle.classList.contains('active')) {
            playInstrument(circle.classList[1]);  // The second class is the instrument name
        }
    });

    // Move to the next beat
    currentBeat = (currentBeat + 1) % 16;
}

sequencerInterval = setInterval(runSequencer, (60 / 120) * 1000 / 4);

// Click and Drag Functionality
let isDragging = false;
let hasMoved = false;
let initialPos = null;

document.addEventListener('mousedown', (e) => {
    isDragging = true;
    hasMoved = false;
    initialPos = { x: e.clientX, y: e.clientY }; // Store the initial mouse position
    // Reset the toggle state for all circles
    circles.forEach(circle => circle.dataset.toggledDuringDrag = "false");
    
    const circle = e.target.closest('.circle');
    if (circle) {
        circle.classList.toggle('active');
        circle.dataset.toggledDuringDrag = "true";
    }
});

document.addEventListener('mouseup', (e) => {
    isDragging = false;

    // If the mouse didn't move significantly, treat it as a click
    if (!hasMoved) {
        const circle = e.target.closest('.circle');
        if (circle) {
            circle.classList.toggle('active');
        }
    }
    initialPos = null;  // Reset the initial position
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const distance = Math.sqrt(Math.pow(initialPos.x - e.clientX, 2) + Math.pow(initialPos.y - e.clientY, 2));
    if (distance > 10) {  // Set a threshold distance, adjust as needed
        hasMoved = true;
    }
    const gridRect = grid.getBoundingClientRect();

    // Define a boundary around the grid (adjust the values as needed)
    const boundary = {
        left: gridRect.left,
        right: gridRect.right,
        top: gridRect.top,
        bottom: gridRect.bottom
    };

    // Check if mouse is within the boundary
    if (e.clientX > boundary.left && e.clientX < boundary.right && 
        e.clientY > boundary.top && e.clientY < boundary.bottom) {

        let closestCircle = null;
        let closestDistance = Infinity;

        circles.forEach(circle => {
            const rect = circle.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distance = Math.sqrt(Math.pow(centerX - e.clientX, 2) + Math.pow(centerY - e.clientY, 2));

            if (distance < closestDistance) {
                closestDistance = distance;
                closestCircle = circle;
            }
        });

        if (closestCircle && closestCircle.dataset.toggledDuringDrag === "false") {
            closestCircle.classList.toggle('active');
            closestCircle.dataset.toggledDuringDrag = "true";
        }
    }
});

const essentia = new Essentia(EssentiaWASM);

// Access the microphone
navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);

        // Create a ScriptProcessorNode to process the audio
        const processor = audioContext.createScriptProcessor(8192, 1, 1); // Increase from 4096 to 8192

        source.connect(processor);
        processor.connect(audioContext.destination);
        // console.log(processor);

        processor.onaudioprocess = function(event) {
            const inputBuffer = event.inputBuffer.getChannelData(0);
            // const inputData = new Float32Array(inputBuffer);

            // Use Essentia.js to detect BPM or other features
            // console.log(inputBuffer);
            // console.log(inputBuffer.length);

            // let inputDataArray = Array.from(inputBuffer);
            const inputVector = essentia.arrayToVector(inputBuffer);
            // console.log(inputVector);

            const rhythm = essentia.RhythmExtractor2013(inputVector);
            console.log(rhythm)
            console.log(essentia.vectorToArray(rhythm.ticks));
            const detectedBPM = rhythm.bpm;
            console.log(detectedBPM)

            // Do something with the detected BPM, like adjusting your sequencer
            adjustSequencerBPM(detectedBPM);
        };
    })
    .catch(error => {
        console.error('Error accessing microphone:', error);
    });

function adjustSequencerBPM(bpm) {
    if (bpm >= 0 && bpm <= 1000) {
        clearInterval(sequencerInterval);
        sequencerInterval = setInterval(runSequencer, (60 / bpm) * 1000 / 4);  // Divided by 4 for 16th notes
    }
}
    