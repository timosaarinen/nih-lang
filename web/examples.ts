export interface Example {
  id: string
  name: string
  description: string
  source: string
}

export const examples: Example[] = [
  {
    id: 'tunnel',
    name: 'Chromatic tunnel',
    description: 'One function, a few waves, a long way down.',
    source: `// NIH WIDE · Chromatic tunnel
// Edit a number. The canvas follows.
// uv: 0..1, top-left origin. t: seconds.

fn palette(x: f32) -> vec3 {
  vec3(0.46, 0.48, 0.55)
    + vec3(0.44, 0.40, 0.44)
    * cos(vec3(x, x, x) + vec3(0.0, 2.0, 4.0));
}

fn pixel(uv: vec2, t: f32) -> vec4 {
  p = (uv * 2.0 - vec2(1.0)) * vec2(1.777778, 1.0);
  drift = vec2(sin(t * 0.25), cos(t * 0.21)) * 0.12;
  q = p + drift;
  radius = sqrt(dot(q, q) + 0.008);
  depth = 1.0 / (radius + 0.06);
  direction = q / radius;

  warp = sin(direction.x * 8.0 + t * 0.6)
       * sin(direction.y * 7.0 - t * 0.5);
  rings = 0.5 + 0.5 * sin(depth * 7.0 - t * 2.8 + warp * 2.3);
  beams = 0.5 + 0.5 * cos((direction.x - direction.y) * 8.0 + depth * 1.4 + t * 0.4);
  mist = 0.5 + 0.5 * sin(q.x * 4.0 + sin(q.y * 6.0 + t) * 1.5 - t * 0.8);

  color = palette(depth * 0.85 - t * 0.4 + warp * 0.7);
  light = rings * rings * 0.9 + beams * 0.25 + mist * 0.15;
  fade = min(radius * 2.0, 1.0);
  vec4(color * light * fade, 1.0);
}
`,
  },
  {
    id: 'plasma',
    name: 'Electric plasma',
    description: 'Layered waves and a shifting color palette.',
    source: `// NIH WIDE · Electric plasma
// Try changing the frequencies or the color offsets.

fn pixel(uv: vec2, t: f32) -> vec4 {
  p = (uv * 2.0 - vec2(1.0)) * vec2(1.777778, 1.0);
  a = sin(p.x * 5.0 + t);
  b = cos(p.y * 6.0 - t * 1.3);
  offset = vec2(sin(t * 0.4), cos(t * 0.6));
  c = sin(length(p + offset) * 8.0 - t * 2.0);
  wave = a + b + c;

  phase = vec3(wave, wave, wave) + vec3(0.0, 2.1, 4.2);
  color = vec3(0.5) + vec3(0.5) * sin(phase + vec3(t * 0.3));
  vec4(color, 1.0);
}
`,
  },
  {
    id: 'gradient',
    name: 'First light',
    description: 'The smallest canvas: coordinates become color.',
    source: `// NIH WIDE · First light
// Every pixel calls this function.
// uv.x moves left to right; uv.y moves top to bottom.

fn pixel(uv: vec2, t: f32) -> vec4 {
  blue = 0.5 + 0.5 * sin(t);
  vec4(uv.x, uv.y, blue, 1.0);
}
`,
  },
]
