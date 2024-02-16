import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';

// Scene, camera, and renderer setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x27002B);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 100;
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Load texture and apply custom shader material
const textureLoader = new THREE.TextureLoader();
textureLoader.load('t.png', function(texture) {
    const geometry = new THREE.PlaneGeometry(5, 3);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            texture: { value: texture }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
    });
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();


// Plane with textured material
const geometry = new THREE.PlaneGeometry(5, 3);
// Vertex shader
const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// Fragment shader
const fragmentShader = `
    uniform sampler2D texture;
    varying vec2 vUv;
    void main() {
        vec4 texColor = texture2D(texture, vUv);
        gl_FragColor = vec4(texColor.rgb, 1.0);
    }
`;
