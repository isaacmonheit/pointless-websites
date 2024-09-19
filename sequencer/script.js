// import Essentia from './node_modules/essentia.js/dist/essentia.js-core.es.js';
// import { EssentiaWASM } from './node_modules/essentia.js/dist/essentia-wasm.es.js';
// // Web Audio API setup
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let hihatBuffer, snareBuffer, kickBuffer, percBuffer;

const hihatGain = audioContext.createGain();
const percGain = audioContext.createGain();
const snareGain = audioContext.createGain();
const kickGain = audioContext.createGain();

hihatGain.gain.value = 0.52; 
percGain.gain.value = 0.52; 
snareGain.gain.value = 0.52;  
kickGain.gain.value = 0.52;   

let totalBeats = 16;
let currentSoundIndex = 0;

let isDragging = false;
let hasMoved = false;
let initialPos = null;
let dragStartedOnCircle = false;
let swingValue = 0;  // Start with no swing

// Allow the play section to accept dragged items
const playSection = document.getElementById('playSection');
const soundBin = document.getElementById('soundBin');


//////////////////////////////// MUTE /////////////////////////////////////

const muteButton = document.getElementById('muteButton');
let isMuted = false;

muteButton.addEventListener('click', () => {
    isMuted = !isMuted;  // Toggle the mute state

    // Update the gain values based on the mute state
    const gainValue = isMuted ? 0 : 1.0;
    hihatGain.gain.value = gainValue;
    percGain.gain.value = gainValue;
    snareGain.gain.value = gainValue;
    kickGain.gain.value = gainValue;

    // Update the button text based on the mute state
    muteButton.textContent = isMuted ? "Unmute" : "Mute";
});




//////////////////////////////// CHANGING INDIVIDUAL SOUNDS /////////////////////////////////////

function switchSound(instrumentType, soundFile) {
    loadAudioFile('/sequencer/sounds/' + soundFile, buffer => {
        switch (instrumentType) {
            case 'hihat':
                hihatBuffer = buffer;
                break;
            case 'perc':
                percBuffer = buffer;
                break;
            case 'snare':
                snareBuffer = buffer;
                break;
            case 'kick':
                kickBuffer = buffer;
                break;
            default:
                console.error("Unknown instrument type: ", instrumentType);
        }
    });
}

////////////////////// SOUNDS SOUNDS SOUNDS SOUNDS SOUNDS //////////////////////////
////////////////////// SOUNDS SOUNDS SOUNDS SOUNDS SOUNDS //////////////////////////
////////////////////// SOUNDS SOUNDS SOUNDS SOUNDS SOUNDS //////////////////////////
////////////////////// SOUNDS SOUNDS SOUNDS SOUNDS SOUNDS //////////////////////////
////////////////////// SOUNDS SOUNDS SOUNDS SOUNDS SOUNDS //////////////////////////


registerSound('synth-1', 'synth1.wav');
registerSound('synth-2', 'synth2.wav');
registerSound('moon-1', 'synth_moon_1.wav');
registerSound('moon-2', 'synth_moon_2.wav');
registerSound('moon-3', 'synth_moon_3.wav');
registerSound('moon-4', 'synth_moon_4.wav');
registerSound('grass-1', 'grass_1.mp3');
registerSound('grass-2', 'grass_2.mp3');
registerSound('grass-3', 'grass_3.mp3');
registerSound('grass-4', 'grass_4.mp3');
registerSound('grass-5', 'grass_5.mp3');
registerSound('grass-6', 'grass_6.mp3');
registerSound('grass-7', 'grass_7.mp3');
registerSound('m-1', 'mushrooms_1.mp3');
registerSound('m-2', 'mushrooms_2.mp3');
registerSound('m-3', 'mushrooms_3.mp3');
registerSound('m-4', 'mushrooms_4.mp3');
registerSound('m-5', 'mushrooms_5.mp3');
registerSound('m-6', 'mushrooms_6.mp3');
registerSound('m-7', 'mushrooms_7.mp3');
registerSound('m-8', 'mushrooms_8.mp3');



document.addEventListener("DOMContentLoaded", function() {
    const sounds = [
        {name: "hat_1", file: "hat1.wav"},
        {name: "hat_2", file: "hat2.wav"},
        {name: "hat_moon", file: "hat_moon.wav"},
        {name: "hat_soft", file: "hat_soft.wav"},
        {name: "snare_1", file: "snare1.wav"},
        {name: "snare_moon", file: "snare_moon.wav"},
        {name: "kick_1", file: "kick1.wav"},
        {name: "kick_moon", file: "kick_moon.wav"},
        {name: "open_hat_1", file: "open_hat.wav"},
        {name: "ride_guilty", file: "ride_guilty.wav"},
        {name: "shaker_guilty", file: "shaker_guilty.wav"},
        {name: "snap_1", file: "snap1.wav"},
        {name: "clap_1", file: "clap1.wav"},
        {name: "stab_1", file: "stab1.wav"},
        {name: "thingy", file: "thingy.wav"},
    ];

    const soundSelectors = document.querySelectorAll(".soundSelector");
    soundSelectors.forEach(selector => {
        sounds.forEach(sound => {
            const option = document.createElement('option');
            option.value = sound.file;
            option.innerText = sound.name;
            selector.appendChild(option);
        });
    });

    const initialSounds = {
        hihat: 'hat1.wav',
        perc: 'open_hat.wav',
        snare: 'snare1.wav',
        kick: 'kick1.wav'
    };

    document.querySelectorAll(".instrumentControls").forEach(control => {
        const soundSelector = control.querySelector(".soundSelector");
        const instrumentType = control.querySelector(".volumeSlider").classList[1].replace("Slider", "");
        soundSelector.value = initialSounds[instrumentType];

        soundSelector.addEventListener('change', function() {
            const newSoundFile = this.value;
            switchSound(instrumentType, newSoundFile);
        });
    });
});







//////////////////////// CHANGING NUMBER OF BEATS IN THE SEQUENCER ///////////////////////////

numBeatsSelect.addEventListener('change', (event) => {
    const activeStates = [];
    const currentCircles = document.querySelectorAll('.circle');
    currentCircles.forEach(circle => {
        activeStates.push(circle.classList.contains('active'));
    });

    totalBeats = parseInt(event.target.value, 10);
    clearSequencerGrid();
    generateBeats();

    previousTime = performance.now();  // Reset the previous time for accurate scheduling
    nextExpectedTime = previousTime + baseDuration;  // Reset the expected time for the next beat

    requestAnimationFrame(runSequencer);  // Restart the sequencer
});





////////////////////////////////////// MAIN CODE ///////////////////////////////////////

function generateBeats() {
    instruments.forEach(instrument => {
        for (let i = 0; i < totalBeats; i++) {
            const circle = document.createElement('div');
            // Attach click event listener to the new circle
            circle.addEventListener('click', function() {
                this.classList.toggle('active');
            });

            circle.classList.add('circle', instrument);
            
            grid.appendChild(circle);
        }
    });

    // Update the circles NodeList
    circles = document.querySelectorAll('.circle');
    
    isDragging = false;
    dragStartedOnCircle = false;    
}


function clearSequencerGrid() {
    while (grid.firstChild) {
        grid.removeChild(grid.firstChild);
    }
}

document.getElementById('hihatVolume').addEventListener('input', (event) => {
    hihatGain.gain.value = event.target.value;
});
document.getElementById('percVolume').addEventListener('input', (event) => {
    percGain.gain.value = event.target.value;
});
document.getElementById('snareVolume').addEventListener('input', (event) => {
    snareGain.gain.value = event.target.value;
});
document.getElementById('kickVolume').addEventListener('input', (event) => {
    kickGain.gain.value = event.target.value;
});


function loadAudioFile(url, callback) {
    fetch(url)
        .then(response => response.arrayBuffer())
        .then(data => audioContext.decodeAudioData(data, callback));
}

loadAudioFile('/sequencer/sounds/hat2.wav', buffer => {hihatBuffer = buffer;});
loadAudioFile('/sequencer/sounds/hat1.wav', buffer => {percBuffer = buffer;});
loadAudioFile('/sequencer/sounds/snare1.wav', buffer => {snareBuffer = buffer;});
loadAudioFile('/sequencer/sounds/kick1.wav', buffer => {kickBuffer = buffer;});


function registerSound(soundName, soundFile) {
    // Load the sound buffer
    loadAudioFile(`/sequencer/sounds/${soundFile}`, buffer => {
        window[soundName + 'Buffer'] = buffer;  // Dynamically set the buffer variable based on sound name
    });

    // Add the sound to the sound bin
    const soundBox = document.createElement('div');
    soundBox.className = 'soundBox';
    soundBox.dataset.sound = soundName;
    soundBox.innerText = soundName.replace(/_/g, ' ');  // Convert underscores to spaces for display
    soundBox.draggable = true;
    soundBox.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', soundBox.dataset.sound);
        e.dataTransfer.setData('source', 'soundBox');
    });

    soundBin.appendChild(soundBox);
}


let currentlyPlayingSynth = null;

function playSound(buffer, gainNode = null) {
    if (!buffer) {
        console.error("Buffer is not defined or invalid.");
        return;
    }
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    if (gainNode) {
        source.connect(gainNode).connect(audioContext.destination);
    } else {
        source.connect(audioContext.destination);
    }
    source.start(0);
    return source; // return the AudioBufferSourceNode
}

function playInstrument(instrument) {
    switch (instrument) {
        case 'hihat':
            playSound(hihatBuffer, hihatGain);
            break;
        case 'perc':
            playSound(percBuffer, percGain);
            break;    
        case 'snare':
            playSound(snareBuffer, snareGain);
            break;
        case 'kick':
            playSound(kickBuffer, kickGain);
            break;
    }
}

// Your sequencer grid setup
const grid = document.getElementById('sequencerGrid');
const instruments = ['hihat', 'perc', 'snare', 'kick'];
let circles = document.querySelectorAll('.circle');

generateBeats();

let currentBeat = 0;

// BPM Updater
const menuIcon = document.getElementById('menuIcon');
const bpmPopup = document.getElementById('bpmPopup');
const bpmInput = document.getElementById('bpmInput');
const tip = document.getElementById('tip');
let bpm = 120
let sequencerInterval = null;

//start open for now
bpmPopup.style.display = 'block';
tip.style.display = 'block';
beatChangeContainer.style.display = 'none';
numBeatsContainer.style.display = 'block';

menuIcon.addEventListener('click', () => {
    bpmPopup.style.display = bpmPopup.style.display === 'none' ? 'block' : 'none';
    tip.style.display = tip.style.display === 'none' ? 'block' : 'none';
    // beatChangeContainer.style.display = beatChangeContainer.style.display === 'none' ? 'block' : 'none';
    numBeatsContainer.style.display = numBeatsContainer.style.display === 'none' ? 'block' : 'none';
});

bpmInput.addEventListener('change', () => {
    bpm = parseFloat(bpmInput.value);
    if (bpm >= 0 && bpm <= 1000) {
        clearInterval(sequencerInterval);
        baseDuration = (60 / bpm) * 1000 / 4;  // The base duration for one 16th note
        sequencerInterval = setInterval(runSequencer, (60 / bpm) * 1000 / 4);  // Divided by 4 for 16th notes
    }
});

sequencerInterval = setInterval(runSequencer, (60 / bpm) * 1000 / 4);












//////////////////////// CLICKING AND DRAGGING ON SEQEUNCER /////////////////////////////


document.addEventListener('mousedown', (e) => {
    const circle = e.target.closest('.circle');
    dragStartedOnCircle = !!circle;  // This will be true if a circle was clicked, false otherwise

    if (!circle) return;

    isDragging = true;
    hasMoved = false;
    initialPos = { x: e.clientX, y: e.clientY }; // Store the initial mouse position
    
    // Reset the toggle state for all circles
    circles.forEach(circle => circle.dataset.toggledDuringDrag = "false");
    
    circle.classList.toggle('active');
    circle.dataset.toggledDuringDrag = "true";
});


document.addEventListener('mouseup', (e) => {
    isDragging = false;
    dragStartedOnCircle = false;  // Reset the flag here

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
    if (!isDragging || !dragStartedOnCircle) return;  // Added the check here

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















////////////////////////// RUNNING SEQUENCER /////////////////////////////////

let hasPlaySectionChanged = false;
let beatChange = 16
const beatChangeSelect = document.getElementById('beatChangeSelect');
beatChangeSelect.addEventListener('change', (event) => {
    beatChange = parseInt(event.target.value, 10);
});

let baseDuration = (60 / bpm) * 1000 / 4;  // The base duration for one 16th note
let isRecording = false;
let recordOneCycle = false;
let previousTime = performance.now(); // Initialize previousTime with the current time

let lastFrameTime = performance.now();
let bpmInterval = (60 / bpm) * 1000 / 4; // Interval per beat

let nextExpectedTime = previousTime + bpmInterval;

function runSequencer() {
    let currentTime = performance.now();
    let timeDifference = currentTime - previousTime;

    if (currentTime >= nextExpectedTime) {
        previousTime = currentTime;
        nextExpectedTime += bpmInterval;

        console.log(`Time difference between beats: ${timeDifference.toFixed(2)} ms`);

        const allCircles = document.querySelectorAll('.circle');
        allCircles.forEach(circle => circle.classList.remove('current'));

        // Get circles for the current beat considering totalBeats
        const currentBeatCircles = document.querySelectorAll(`.circle:nth-child(${totalBeats}n+${currentBeat+1})`);

        currentBeatCircles.forEach(circle => {
            circle.classList.add('current');
            if (circle.classList.contains('active')) {
                playInstrument(circle.classList[1]);  // The second class is the instrument name
            }
        });

        // Check recording status and record 1 loop
        if (currentBeat === 0 && isRecording && !recordOneCycle) {
            startRecording();
            recordOneCycle = true;
        } else if (currentBeat === 0 && isRecording && recordOneCycle) {
            stopRecording();
            isRecording = false;
            recordOneCycle = false;
        }

        // Move to the next beat
        currentBeat = (currentBeat + 1) % totalBeats;

        if (currentBeat % (Math.min(beatChange, totalBeats)) === 1 || beatChange === 1 || hasPlaySectionChanged) {
            const playSectionBoxes = playSection.querySelectorAll('.soundBox');
            if (playSectionBoxes.length) {
                const currentSound = playSectionBoxes[currentSoundIndex].dataset.sound;
                if (soundBuffers[currentSound]) {
                    if (currentlyPlayingSynth) {
                        currentlyPlayingSynth.stop();
                    }
                    currentlyPlayingSynth = playSound(soundBuffers[currentSound]);
                }

                currentSoundIndex = (currentSoundIndex + 1) % playSectionBoxes.length;
            }

            hasPlaySectionChanged = false; // Reset the flag
        }
    }

    requestAnimationFrame(runSequencer);
}

// Start the sequencer
requestAnimationFrame(runSequencer);





const swingSlider = document.getElementById('swingSlider');
swingSlider.addEventListener('input', (event) => {
    swingValue = parseFloat(event.target.value);
    clearInterval(sequencerInterval);
    sequencerInterval = setInterval(runSequencer, (60 / bpm) * 1000 / 4);
});










/////////////////////////// DRAG AND DROP MECHANIC /////////////////////////////




document.querySelectorAll('#playSection .soundBox').forEach(box => {
    box.draggable = true;
    box.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', box.dataset.sound);
        e.dataTransfer.setData('source', 'playSection'); // Indicate the source of the drag
    });
});

[playSection, soundBin].forEach(container => {
    container.addEventListener('dragover', e => {
        e.preventDefault();  // Allow dropping
    });
});

playSection.addEventListener('drop', e => {
    e.preventDefault();

    const soundData = e.dataTransfer.getData('text/plain');
    const dragSource = e.dataTransfer.getData('source');

    if (dragSource === 'playSection') {
        // Dragging within the playSection
        const draggedBox = document.querySelector(`#playSection [data-sound="${soundData}"]`);
        rearrangeBoxes(draggedBox, e.clientX);
    } else {
        // Dragging from the soundBin
        const soundBoxToClone = document.querySelector(`[data-sound="${soundData}"]`);
        if (!soundBoxToClone) {
            console.error(`No soundBox found for sound: ${soundData}`);
            return; // exit the function if no soundBox is found
        }

        const newBox = soundBoxToClone.cloneNode(true);
        const closeButton = document.createElement('span');
        closeButton.innerText = 'x';

        closeButton.addEventListener('click', function() {
            if (soundData.startsWith('synth')) {  // Check if it's a synth sound
                const synthBoxes = playSection.querySelectorAll('.soundBox[data-sound^="synth"]');
                if (synthBoxes.length === 1) {  // Check if this is the last synth box
                    if (currentlyPlayingSynth) {
                        currentlyPlayingSynth.stop();
                    }
                }
            }
            playSection.removeChild(newBox);
            hasPlaySectionChanged = true;
            currentSoundIndex = 0;
        });
        newBox.appendChild(closeButton);

        rearrangeBoxes(newBox, e.clientX, true);
    }
    // hasPlaySectionChanged = true;
});

function rearrangeBoxes(box, clientX, isClone = false) {
    let closestBox = null;
    let closestDistance = Infinity;
    let insertAfter = false;

    const playSectionBoxes = playSection.querySelectorAll('.soundBox');
    playSectionBoxes.forEach(existingBox => {
        const boxRect = existingBox.getBoundingClientRect();
        const boxCenterX = boxRect.left + (boxRect.width / 2);
        const distance = Math.abs(boxCenterX - clientX);

        if (distance < closestDistance) {
            closestDistance = distance;
            closestBox = existingBox;
            insertAfter = clientX > boxCenterX;
        }
    });

    if (closestBox) {
        if (insertAfter) {
            closestBox.after(box);
        } else {
            closestBox.before(box);
        }
    } else {
        playSection.appendChild(box);
    }

    // If the box is a clone, we need to make it draggable for future drag operations within playSection
    if (isClone) {
        box.draggable = true;
        box.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', box.dataset.sound);
            e.dataTransfer.setData('source', 'playSection'); // Indicate the source of the drag
        });
    }
}



/////////////////////////// RECORDING THE SEQUENCE /////////////////////////////
/////////////////////////// RECORDING THE SEQUENCE /////////////////////////////
/////////////////////////// RECORDING THE SEQUENCE /////////////////////////////
/////////////////////////// RECORDING THE SEQUENCE /////////////////////////////
/////////////////////////// RECORDING THE SEQUENCE /////////////////////////////

let recorderNode = null;

function startRecording() {
    recorderNode.port.postMessage('start');
}

function stopRecording() {
    recorderNode.port.postMessage('stop');
}

async function setupAudioWorklet() {
    await audioContext.audioWorklet.addModule('recorder-worklet.js');
    recorderNode = new AudioWorkletNode(audioContext, 'recorder-processor');

    recorderNode.port.onmessage = (event) => {
        const recordedChunks = event.data;
        if (recordedChunks.length === 0) {
            console.error('No recorded data received.');
            return;
        }

        const bufferLength = recordedChunks.reduce((total, chunk) => total + chunk.length, 0);
        const audioBuffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
        const bufferData = audioBuffer.getChannelData(0);

        let offset = 0;
        recordedChunks.forEach((chunk) => {
            bufferData.set(chunk, offset);
            offset += chunk.length;
        });

        const wav = audioBufferToWav(audioBuffer);
        const blob = new Blob([wav], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'loop.wav';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    };

    hihatGain.connect(recorderNode);
    percGain.connect(recorderNode);
    snareGain.connect(recorderNode);
    kickGain.connect(recorderNode);
    recorderNode.connect(audioContext.destination);

    return recorderNode;
}

document.getElementById('downloadButton').addEventListener('click', async () => {
    recorderNode = await setupAudioWorklet();
    isRecording = true;
});


function audioBufferToWav(buffer) {
    const numOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numOfChannels * 2 + 44;
    const bufferData = new ArrayBuffer(length);
    const view = new DataView(bufferData);
    const channels = [];
    let sample;
    let offset = 0;
    let pos = 0;

    // write WAV header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    // write format chunk
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChannels);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChannels); // avg. bytes/sec
    setUint16(numOfChannels * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this demo)

    // write data chunk
    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // write interleaved data
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numOfChannels; channel++) {
            sample = buffer.getChannelData(channel)[i] * 0x7fff; // convert to 16-bit PCM
            if (sample < 0) {
                sample = Math.max(sample, -0x8000);
            } else {
                sample = Math.min(sample, 0x7fff);
            }
            view.setInt16(pos, sample, true);
            pos += 2;
        }
    }

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }

    return bufferData;
}

hihatGain.connect(audioContext.destination);
percGain.connect(audioContext.destination);
snareGain.connect(audioContext.destination);
kickGain.connect(audioContext.destination);

