// import Essentia from './node_modules/essentia.js/dist/essentia.js-core.es.js';
// import { EssentiaWASM } from './node_modules/essentia.js/dist/essentia-wasm.es.js';
// // Web Audio API setup
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let hihatBuffer, snareBuffer, kickBuffer;

const hihatGain = audioContext.createGain();
const snareGain = audioContext.createGain();
const kickGain = audioContext.createGain();

hihatGain.gain.value = 1.0; 
snareGain.gain.value = 1.0;  
kickGain.gain.value = 1.0;   

let totalBeats = 16;
let currentSoundIndex = 0;

let isDragging = false;
let hasMoved = false;
let initialPos = null;
let dragStartedOnCircle = false;

//////////////////////// CHANGING NUMBER OF BEATS IN THE SEQUENCER ///////////////////////////

numBeatsSelect.addEventListener('change', (event) => {
    // 1. Store the active states of the current beats
    const activeStates = [];
    const currentCircles = document.querySelectorAll('.circle');
    currentCircles.forEach(circle => {
        activeStates.push(circle.classList.contains('active'));
    });

    clearInterval(sequencerInterval);
    totalBeats = parseInt(event.target.value, 10);
    clearSequencerGrid();
    generateBeats();

    // 2. Reapply the active states to the newly generated beats
    // const newCircles = document.querySelectorAll('.circle');
    // for (let i = 0; i < activeStates.length; i++) {
    //     if (activeStates[i]) {
    //         newCircles[i].classList.add('active');
    //     }
    // }

    // 3. Restart the sequencer loop
    
    sequencerInterval = setInterval(runSequencer, (60 / bpm) * 1000 / 4);
});

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

let synth1Buffer, synth2Buffer;
loadAudioFile('/sequencer/sounds/synth1.wav', buffer => {
    synth1Buffer = buffer;
});

loadAudioFile('/sequencer/sounds/synth2.wav', buffer => {
    synth2Buffer = buffer;
});

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
const instruments = ['hihat', 'snare', 'kick'];
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

menuIcon.addEventListener('click', () => {
    bpmPopup.style.display = bpmPopup.style.display === 'none' ? 'block' : 'none';
    tip.style.display = tip.style.display === 'none' ? 'block' : 'none';
});

bpmInput.addEventListener('change', () => {
    bpm = parseFloat(bpmInput.value);
    if (bpm >= 0 && bpm <= 1000) {
        clearInterval(sequencerInterval);
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


function runSequencer() {
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

    // Move to the next beat
    currentBeat = (currentBeat + 1) % totalBeats;

    if (currentBeat % (Math.min(beatChange, totalBeats)) === 1 || beatChange === 1 || hasPlaySectionChanged) {
        const playSectionBoxes = playSection.querySelectorAll('.soundBox');
        if (playSectionBoxes.length) {
            const currentSound = playSectionBoxes[currentSoundIndex].dataset.sound;
            if (currentSound === 'synth1' && synth1Buffer) {
                // Stop the previously playing synth sound
                if (currentlyPlayingSynth) {
                    currentlyPlayingSynth.stop();
                }
                currentlyPlayingSynth = playSound(synth1Buffer);
            } else if (currentSound === 'synth2' && synth2Buffer) {
                // Stop the previously playing synth sound
                if (currentlyPlayingSynth) {
                    currentlyPlayingSynth.stop();
                }
                currentlyPlayingSynth = playSound(synth2Buffer);
            }

            currentSoundIndex = (currentSoundIndex + 1) % playSectionBoxes.length;
        }

        hasPlaySectionChanged = false; // Reset the flag
    }
}














/////////////////////////// DRAG AND DROP MECHANIC /////////////////////////////

// Make each sound box draggable
document.querySelectorAll('.soundBox').forEach(box => {
    box.draggable = true;

    box.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', box.dataset.sound);
        e.dataTransfer.setData('source', 'soundBox'); // Indicate the source of the drag
    });
});

// Allow the play section to accept dragged items
const playSection = document.getElementById('playSection');
const soundBin = document.getElementById('soundBin');

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