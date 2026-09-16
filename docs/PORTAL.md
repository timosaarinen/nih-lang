# Portal benchmark

The portal is NIH's graphics moonshot and visual regression target.

The reference mood is the classic procedural shader-demo / Shadertoy cloudy-tunnel family: impossible depth from math, no authored texture dependency, and motion that makes a flat surface feel like a hole into somewhere else. NIH should eventually go substantially beyond that baseline rather than merely porting an old shader.

## Test ladder

### 01 — rotating triangle

Prove that NIH numeric code reaches a real GPU pipeline.

- three vertices
- vertex rotation computed by NIH-generated WGSL
- procedural fragment color computed by NIH-generated WGSL
- time/aspect supplied by a tiny WebGPU wrapper
- no vertex buffer required

Source: `examples/gpu_triangle.nih`

### 02 — portal triangle

Keep the geometry and host path identical. Replace only the NIH fragment logic.

Current prototype ingredients:

- layered value noise / FBM
- domain rotation and warping
- inverse-radius depth coordinate
- animated tunnel rings
- directional/spoke interference
- hot core
- cyan/violet cloud energy
- glowing triangle boundary
- no image textures

Source: `examples/gpu_portal.nih`

This is a baseline, **not** the claimed final "best portal ever".

### 03 — full-screen portal

Use the effect as a full-screen GPU benchmark so triangle coverage no longer hides expensive regions. Add GPU timing and stable screenshot/video capture.

### 04 — depth

To beat excellent single-pass shader demos, target actual perceptual depth rather than only adding more noise:

- raymarched or sliced volumetric density
- coherent 3D domain warping
- curl-like flow rather than UV scrolling
- occluding cloud structures
- a readable destination or impossible geometry beyond the aperture
- emissive scattering through density
- edge refraction/distortion
- controlled bloom/tonemap rather than clipping to white

### 05 — temporal quality

A great still frame is insufficient.

- no boiling noise
- stable motion under camera movement
- temporal reprojection/history where worthwhile
- quality tiers with deterministic seeds
- 60/120 Hz friendly animation
- capture mode for frame-by-frame regression

### 06 — interaction

This is where NIH can beat static Shadertoy-style presentation:

- portal reacts to pointer/player proximity
- disturbances propagate through the field
- objects/light can cross the boundary
- compute stage can maintain persistent flow/density state
- CPU reference functions can test pieces of the same math

## Success criteria

"Better" is subjective, so use concrete engineering targets too:

- unmistakable tunnel/depth read at a glance
- remains interesting for >30 seconds instead of relying on one reveal
- temporal coherence with no obvious looping texture motion
- one shared NIH math implementation where CPU validation is useful
- runs as real WebGPU code generated from NIH
- scalable quality/performance rather than one unshippable hero shader
- automated capture path for visual comparisons

The portal should become both a showcase and a forcing function for missing language features: loops, matrices, structs, stage IO, textures, storage buffers, compute, atomics, derivatives, profiling and GPU debugging.
