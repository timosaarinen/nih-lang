import { compileAndRun } from '../../src/nihlib'
import * as THREE from 'three';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

const initialCode = 
`#lang = nih-sexpr
(let WIDTH 16)
(let HEIGHT 16)

(:int fun mandelbrot (:float cx :float cy)
  (doc "@returns # of iterations (0 if not in Mandelbrot set)")
  (let maxiters 80)
  (set! zx 0)
  (set! zy 0)
  (set! n 0)
  (do-while (
    (let px (- (^ zx 2) (^ zy 2)))
    (let py (- (* 2 zx zy)))
    (set! zx (+ px cx))
    (set! zy (+ py cy))
    (let d (sqrt (+ (^ zx 2) (^ zy 2))))
    (inc! n)
    (if (> d 2) (return 0.0))
  ) (< n maxiters))
  (return n))

(let rs -2.0)
(let re 1.0)
(let is -1.0)
(let ie 1.0)

(for-lt i 0 WIDTH
  (for-lt j 0 HEIGHT
    (let cx (+ rs (* (/ i :float WIDTH) (- re rs))))
    (let cy (+ is (* (/ j :float HEIGHT) (- ie is))))
    (let m (call mandelbrot cx cy))
    (call printchars (? (> m 0.0) '*' ' '))
    (call printlf)))
`;

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

document.addEventListener('DOMContentLoaded', function() {
  monaco.editor.defineTheme('nih', {
    base: 'hc-black',
    inherit: true,
    rules: [
        { token: 'comment', foreground: 'ffffff', fontStyle: 'italic underline' },
        { token: 'comment.js', foreground: '00A000', fontStyle: 'bold' },
        { token: 'comment.css', foreground: '0000ff' }
    ],
    colors: {
        'editor.foreground': '#00ff00',
        'editor.background': '#10101080',
  }});

  let editor = monaco.editor.create(getEditorElement(), {
    value: initialCode,
    language: 'nih!', // TODO:
    theme: 'nih',
    minimap: {
      enabled: false, //true,
    },
  });

  editor.onDidChangeModelContent((event) => {
    console.log("**** Code changed - Recompiling ****");
    const sourcecode = editor.getValue();

    // TODO: capture compile errors and execution output, pass {config} to compileAndRun()
    document.getElementById('output').textContent = '[Build #' + (numChanges++) + ']\n\n' + sourcecode;

    //console.log(sourcecode);
    //console.log(event);
    // TODO: compile and run, pass 'printchars' function to capture output
    compileAndRun(sourcecode);
  });
  compileAndRun(editor.getValue()); // TODO: don't run before change?
});
