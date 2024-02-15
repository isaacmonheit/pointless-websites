import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x27002B); // Sky blue color
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);


// Particle material
const particleMaterial = new THREE.PointsMaterial({
    color: 0x004f80,
    size: 1,
    blending: THREE.AdditiveBlending,
    transparent: true,
    sizeAttenuation: true,
});

// Create particles
const particlesGeometry = new THREE.BufferGeometry();
const particleCount = 10000;
const posArray = new Float32Array(particleCount * 3);
// Store original positions
const originalPositions = new Float32Array(particleCount * 3);
for(let i = 0; i < particleCount * 3; i++) {
    const value = (Math.random() - 0.5) * 50; // Random positions
    posArray[i] = value;
    originalPositions[i] = value; // Copy original position
}
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

const particleMesh = new THREE.Points(particlesGeometry, particleMaterial);
scene.add(particleMesh);

camera.position.z = 100;

function animate() {
    requestAnimationFrame(animate);
    particleMesh.rotation.y += 0.005;
    // Gradually move particles back to their original positions
    const positions = particleMesh.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i++) {
        positions[i] += (originalPositions[i] - positions[i]) * 0.05;
    }
    particleMesh.geometry.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
}

animate();

// Mouse interaction
const mouse = new THREE.Vector2();
const windowHalf = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
let planeIntersect = new THREE.Vector3(); // Use let since this will be updated

document.addEventListener('mousemove', (event) => {
    // Calculate the mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Calculate the intersection of the picking ray with the virtual plane
    raycaster.ray.intersectPlane(plane, planeIntersect);

    // Attract particles towards this intersection point
    const positions = particleMesh.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
        const dx = positions[i] - planeIntersect.x;
        const dy = positions[i + 1] - planeIntersect.y;
        const dz = positions[i + 2] - planeIntersect.z; // Including Z-axis
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const maxDistance = 28;
        if (distance < maxDistance) {
            // Adjust the direction of the force to attract towards the mouse
            const force = (1 - distance / maxDistance) * 2;
            positions[i] -= dx * force * 0.1;
            positions[i + 1] -= dy * force * 0.1;
            positions[i + 2] -= dz * force * 0.1; // Move towards the mouse along z-axis
        }
    }
    particleMesh.geometry.attributes.position.needsUpdate = true;
});


// Resize canvas on window resize
window.addEventListener('resize', () => {
    windowHalf.set(window.innerWidth / 2, window.innerHeight / 2);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
