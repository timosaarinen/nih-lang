import * as THREE from 'three';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

const initialCode = `// Start typing your code here
print 'Hello, world!'`;

//------------------------------------------------------------------------
// Scene setup
const scene = new THREE.Scene();

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 1.2;

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a cube
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshPhongMaterial({ });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Add directional lights
const directionalLight = new THREE.DirectionalLight(0xffff10, 5.0);
directionalLight.position.set(5, 3, 5);
scene.add(directionalLight);

const h = new THREE.HemisphereLight(0x4080ff, 0x081040, 1.0);
scene.add(h);

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Rotate the cube
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    // Render the scene
    renderer.render(scene, camera);
}

animate();

// Handle window resizing
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}


//------------------------------------------------------------------------
let numChanges = 0;

const getEditorElement = () => {
  return document.getElementById('editor');
}

const onchange = () => {
  console.log("TODO: Code changed - recompiling..");
  document.getElementById('output').textContent = 'Compile #' + (numChanges++);
}

document.addEventListener('DOMContentLoaded', function() {

  monaco.editor.create(getEditorElement(), {
    value: initialCode,
    language: 'nih', // TODO:
    theme: 'vs-dark',
    minimap: {
      enabled: true,
    },
  });

});
