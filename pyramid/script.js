import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 50;
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const mouse = new THREE.Vector2();
let isMouseDown = false; // Track if the mouse is pressed

scene.background = new THREE.Color(0x008000); // Set background to green

// When creating the pyramid, adjust the base size and height to make it larger
const pyramidBaseSize = 20; // Increase the base size for a larger pyramid
const pyramidHeight = 20; // Increase the height for a larger pyramid
const particlesGeometry = createPyramidParticles(pyramidBaseSize, pyramidHeight, 5000);

// Add ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Add directional light
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(0, 1, 1);
scene.add(directionalLight);



// Particle material
const particleMaterial = new THREE.PointsMaterial({
    color: 0x004f80,
    size: 1,
    blending: THREE.AdditiveBlending,
    transparent: true,
    sizeAttenuation: true,
});



// Function to create pyramid particles
function createPyramidParticles(baseSize, height, particleCount) {
    const positions = new Float32Array(particleCount * 3);
    let index = 0;
    for (let i = 0; i < particleCount; i++) {
        const level = Math.random(); // Level from base (0) to tip (1)
        const radius = baseSize * (1 - level); // Radius decreases towards the tip
        const theta = Math.random() * Math.PI * 2;
        const x = radius * Math.cos(theta);
        const y = radius * Math.sin(theta);
        const z = level * height; // Height based on level
        positions[index++] = x;
        positions[index++] = y;
        positions[index++] = z - height / 2; // Center pyramid along Z-axis
    }
    return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3));
}

const originalPositions = particlesGeometry.attributes.position.array.slice(); // Clone original positions
const particles = new THREE.Points(particlesGeometry, particleMaterial);
scene.add(particles);

// Mouse event listeners
document.addEventListener('mousedown', () => isMouseDown = true);
document.addEventListener('mouseup', () => isMouseDown = false);
document.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

function spinParticles() {
    const positions = particles.geometry.attributes.position.array;
    let spinSpeed = 0.01; // Adjust this value if needed

    // Calculate the center of the pyramid for a more accurate rotation
    let centerX = 0, centerY = 0, centerZ = 0; // Assuming pyramid's base is centered at the origin

    for (let i = 0; i < positions.length; i += 3) {
        let x = positions[i] - centerX;
        let z = positions[i + 2] - centerZ;

        // Apply rotation around the Y-axis
        positions[i] = centerX + x * Math.cos(spinSpeed) - z * Math.sin(spinSpeed);
        positions[i + 2] = centerZ + x * Math.sin(spinSpeed) + z * Math.cos(spinSpeed);
    }
    particles.geometry.attributes.position.needsUpdate = true;
}

function animate() {
    requestAnimationFrame(animate);

    if (isMouseDown) {
        // Pull particles towards the mouse position when clicked

        pullParticlesTowardsMouse();
    } else {
        // Spin particles when the mouse is not pressed and gradually move them back to original positions
        spinParticles();
        resetParticlePositions();
    }

    renderer.render(scene, camera);
}




function pullParticlesTowardsMouse() {
    const positions = particles.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
        // Simplified pull effect: move particles towards the screen center
        positions[i] += (mouse.x * 50 - positions[i]) * 0.1;
        positions[i + 1] += (mouse.y * 50 - positions[i + 1]) * 0.1;
    }
    particles.geometry.attributes.position.needsUpdate = true;
}

function resetParticlePositions() {
    const positions = particles.geometry.attributes.position.array;
    let isParticleMoved = false; // Flag to check if any particle has moved significantly

    for (let i = 0; i < positions.length; i += 3) {
        const originalX = originalPositions[i];
        const originalY = originalPositions[i + 1];
        const originalZ = originalPositions[i + 2];
        
        const dx = originalX - positions[i];
        const dy = originalY - positions[i + 1];
        const dz = originalZ - positions[i + 2];
        const distanceSquared = dx * dx + dy * dy + dz * dz;

        // Check if the particle has been displaced significantly from its original position
        if (distanceSquared > 0.01) { // Threshold can be adjusted
            positions[i] += dx * 0.05; // Adjust speed as needed
            positions[i + 1] += dy * 0.05;
            positions[i + 2] += dz * 0.05;
            isParticleMoved = true;
        }
    }

    if (isParticleMoved) {
        particles.geometry.attributes.position.needsUpdate = true;
    }
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
