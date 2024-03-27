import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

let particleMesh

const earthTexture = new THREE.TextureLoader().load('earth2.jpg', texture => {
    // Set texture wrapping here inside the callback
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1, 1); // This ensures the texture is not tiled
    createParticles(texture);
});


function createParticles(texture) {
    const particleCount = 2000000;
    const particlesGeometry = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);
    const uvArray = new Float32Array(particleCount * 2); // For UV mapping
    
    for (let i = 0; i < particleCount; i++) {
        // Spherical coordinates
        const phi = Math.acos(2 * Math.random() - 1); // inclination
        const theta = 2 * Math.PI * Math.random(); // azimuth
        const radius = 100; // Sphere radius
    
        // Convert spherical coordinates to Cartesian coordinates for particle position
        posArray[i * 3] = radius * Math.sin(phi) * Math.cos(theta); // x
        posArray[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta); // y
        posArray[i * 3 + 2] = radius * Math.cos(phi); // z
    
        // Correct UV mapping
        const u = theta / (2 * Math.PI);
        const v = 0.5 - Math.asin(posArray[i * 3 + 2] / radius) / Math.PI;
    
        uvArray[i * 2] = u;
        uvArray[i * 2 + 1] = v;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesGeometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2)); // Add UVs to the geometry

    const shaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            earthTexture: { value: texture },
            pointSize: { value: 2.0 } // This value can be adjusted as needed
        },
        vertexShader: `
            varying vec2 vUv;
            uniform float pointSize;
            void main() {
                vUv = uv;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                float distance = length(mvPosition.xyz);
                gl_PointSize = pointSize * (10.0 / distance); // Adjusts size based on distance
            }
        `,
        fragmentShader: `
            uniform sampler2D earthTexture;
            varying vec2 vUv;
            void main() {
                vec4 texColor = texture2D(earthTexture, vUv);
                if (texColor.a < 0.5) discard; // Optional: Discard fully transparent pixels
                gl_FragColor = texColor;
            }
        `,
        transparent: true,
    });

    // shaderMaterial.uniforms.pointSize.value = 20.0; // Set to desired pixel size
    
    particleMesh = new THREE.Points(particlesGeometry, shaderMaterial);
    scene.add(particleMesh);
    camera.position.z = 100;

}


function animate() {
    requestAnimationFrame(animate);
    if (particleMesh) {
        particleMesh.rotation.y += 0.005; // Adjust speed as needed
    }
    renderer.render(scene, camera);
}

animate();



const windowHalf = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);
// Resize canvas on window resize
window.addEventListener('resize', () => {
    windowHalf.set(window.innerWidth / 2, window.innerHeight / 2);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
