import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

let scene, camera, renderer, controls, object;

function init() {
    // Set up the scene and camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Set up the renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Load the .obj file
    const loader = new OBJLoader();
    loader.load('SPHYNX888(3dviewer).obj', function (loadedObject) {
        const box = new THREE.Box3().setFromObject(loadedObject);
        console.log(box.min, box.max, box.getSize(new THREE.Vector3()));

        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        loadedObject.position.x += (loadedObject.position.x - center.x);
        loadedObject.position.y += (loadedObject.position.y - center.y);
        loadedObject.position.z += (loadedObject.position.z - center.z);
        // loadedObject.scale.set(0.5, 0.5, 0.5);  // Adjust the scale values as needed

        object = loadedObject;
        scene.add(object);
    });
    
    const ambientLight = new THREE.AmbientLight(0x404040, 1);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);
    
    





    // Set up controls for rotation
    controls = new OrbitControls(camera, renderer.domElement);

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
