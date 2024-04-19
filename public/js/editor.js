import * as THREE from 'three';

const initialCode = `
// Start typing your code here
print 'Hello, world!'`;

//------------------------------------------------------------------------
// Scene setup
const scene = new THREE.Scene();

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a cube
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Set camera position
camera.position.z = 5;

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
document.addEventListener('DOMContentLoaded', function() {

  const editor = CodeMirror(document.getElementById('editor'), {
      mode: 'javascript',
      theme: 'dracula',
      lineNumbers: true,
      value: initialCode
  });
  editor.setSize("100%", "100%");

  editor.on('change', function() {
      fetch('/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: editor.getValue() })
      })
      .then(response => response.json())
      .then(data => {
          document.getElementById('output').textContent = data.output;
      })
      .catch(error => {
          document.getElementById('output').textContent = 'Error: ' + error;
      });
  });
});
