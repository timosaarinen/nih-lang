import { compileAndRun } from '../../src/nihlib'
import * as THREE from 'three';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

//------------------------------------------------------------------------
//  Example code (TODO: fetch with HTTPS to keep up-to-date?)
//------------------------------------------------------------------------
const initialCode = 
`
# Mandelbrot with Nih-sexpr syntax
#lang = nih-sexpr
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

# And the same in C-family syntax, **Nih-C**

#lang = nih-c
// Mandelbrot set with console output

WIDTH = 16
HEIGHT = 16

:float mandelbrot(:float cx, :float cy)
  // @returns # of iterations (0 if not in Mandelbrot set)
  maxiters = 80
  zx := 0
  zy := 0
  n := 0
  do:
    px = zx^2 - zy^2
    py = 2 * zx * zy
    zx := px + cx
    zy := py + cy
    d = sqrt(zx^2 + zy^2)
    n++
    if d > 2 return 0 // if not in Mandelbrot set, early return
  while n < maxiters
  return n

//------------------------------------------------------------------------
rs = -2.0
re = 1.0
is = -1.0
e = 1.0

for i = 0..WIDTH
  for j = 0..HEIGHT
    cx = rs + :float i / WIDTH * (re - rs)
    cy = is + :float j / HEIGHT * (ie - is)
    m = mandelbrot(cx, cy)
    printchars(m > 0.0 ? '*' : ' ')
  printlf()
`;

//------------------------------------------------------------------------
//  Util
//------------------------------------------------------------------------
const lerp = (min, max, t) => { return min + t*(max-min); }
const rand01 = () => { return Math.random() }
const randsigned1 = () => { return 2 * Math.random() - 1.0; }

//------------------------------------------------------------------------
//  3D background scene
//------------------------------------------------------------------------
const scene = new THREE.Scene();
let t = 0.0;
let animations = [];
const animateeachframe = (cb) => { animations.push(cb); } 

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 42.0;

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 3D object
const geometry = new THREE.TorusKnotGeometry( 22, 6, 420, 128 );
const material = new THREE.MeshPhysicalMaterial({});
const obj = new THREE.Mesh(geometry, material);
scene.add(obj);
animateeachframe( () => { const s=2; obj.rotation.x += s*0.0009; obj.rotation.y += s*0.0007; } );

// Lights
const light = new THREE.SpotLight(0xa0fff0, 4000.0);
//light.position.set(-20, 30, -10);
animateeachframe( () => { const s=0.1; light.position.set(-20 * Math.sin(s*t), 30 * Math.cos(0.7*s*t)*Math.cos(0.00997*s*t*t), -10 * Math.cos(s*t)); } );
scene.add(light);

const hemilight = new THREE.HemisphereLight(0x4080ff, 0xff1040, 0.05);
scene.add(hemilight);

// Render frame
function renderframe(time) {
  t = 0.001*time;
  requestAnimationFrame(renderframe);
  animations.forEach((cb) => cb());
  renderer.render(scene, camera);
}
renderframe();

// Handle window resizing
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize, false);

//------------------------------------------------------------------------
//  Bonus: random cubes 'n stuff (TODO)
//------------------------------------------------------------------------
function newcube() {
  const size = lerp(0.1, 2.0, rand01);
  const numsegments = 4;
  const geometry = new THREE.BoxGeometry( size, size, size, numsegments, numsegments, numsegments );
  const material = new THREE.MeshPhysicalMaterial({}); // TODO: reuse mats?
  const obj = new THREE.Mesh(geometry, material); 
  scene.add(obj);
  animations.push(() => { obj.rotation.x += 0.009; obj.rotation.y += 0.007; obj.position.y += 0.01*randsigned1; })
}

//------------------------------------------------------------------------
//  Simple text -> HTML
//------------------------------------------------------------------------
function setmd(e, md) {
  let s = md;
  s = s.replace(/^# (.*?)(\n|$)/gm, '<h1>$1</h1>\n'); // # Header1 -> <h1>..</h1>
  s = s.replace(/^## (.*?)(\n|$)/gm, '<h2>$1</h2>\n'); // ## Header2 -> <h2>..</h2>
  s = s.replace(/\n/g, '<br>'); // newlines
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); // **bold** -> <b>bold</b>
  s = s.replace(/\*([^*]+)\*/g, '<i>$1</i>'); // *italic* -> <i>italic</i>
  s = s.replace(/(\w)\^(\w+)/g, '$1<sup>$2</sup>'); // Convert superscript x^2 -> x<sup>2</sup>
  s = s.replace(/ {2,}/g, match => '&nbsp;'.repeat(match.length)); // 2+ spaces
  e.innerHTML = s;
}

//------------------------------------------------------------------------
//  Live code editor, output and REPL UI
//------------------------------------------------------------------------
const editor_e = document.getElementById('editor');
const output_e = document.getElementById('output');
const repl_e   = document.getElementById('repl');
const output = (s) => { setmd(output_e, s); }
const repl   = (s) => { setmd(repl_e, s); }

const editortheme = 'nih';
let   numchanges  = 0;    // # of times editor source code has been compiled
let   editor = null;      // Code editor, Monaco

function newtheme() {
  monaco.editor.defineTheme(editortheme, {
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
  return editortheme;
}

function neweditor() {
  return editor = monaco.editor.create(editor_e, {
    value: initialCode,
    language: 'nih!', // TODO:
    theme: newtheme(),
    minimap: {
      enabled: false,
    }
  });
}

function listen_codechange(editor, cb) {
  editor.onDidChangeModelContent((event) => { cb(event) });
  cb({}); // TODO: DEBUG: run once in startup for faster debugging
}

function on_codechange(event) {
  console.log("**** Code changed - Recompiling ****");
  const sourcecode = editor.getValue();
  output(`## Code^${numchanges++}\n${sourcecode}`); // TODO: capture compile errors and execution output, pass {config} to compileAndRun()
  repl(`${JSON.stringify(event, null, 2)}`);           // TODO: don't misuse REPL! ..but actually, show the compiler errors there for now
  compileAndRun(sourcecode);                           // TODO: compile and run, pass 'printchars' function to capture output
}

document.addEventListener('DOMContentLoaded', function() {
  listen_codechange(neweditor(), on_codechange);
});
