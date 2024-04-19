import * as THREE from 'three';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

const initialCode = `// Start typing your code here
print 'Hello, world!'`;

//------------------------------------------------------------------------
// Scene setup
const scene = new THREE.Scene();

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 42.0;

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a 3D object
const geometry = new THREE.TorusKnotGeometry( 22, 6, 420, 128 );
const material = new THREE.MeshPhysicalMaterial({});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Add a light
const light = new THREE.SpotLight(0xa0fff0, 4000.0);
light.position.set(-20, 30, -10);
scene.add(light);

const h = new THREE.HemisphereLight(0x4080ff, 0xff1040, 0.05);
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
