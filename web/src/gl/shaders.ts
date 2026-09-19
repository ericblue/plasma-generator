export const VERT = `#version 300 es
// Fullscreen triangle -- no vertex buffer needed.
out vec2 vUV;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

/**
 * One shader, three plasma families, authentic and modern render paths.
 *
 * Mode 0 -- Mulvey 1988: sample a static index texture and rotate the palette.
 *           This is literally what the VGA DAC did: the framebuffer never
 *           changes, only the lookup does.
 * Mode 1 -- Plasma Lab: compute a sum-of-sines field per pixel with time as an
 *           argument, so the SHAPES move, then run it through the same palette.
 * Mode 2 -- Tom Dibble 1994: sample the CPU-composited swimming window and use
 *           its dynamically rotated 256-entry palette without remapping indices.
 * Modes 3/4 -- modern Tom: compose two normalized half-size source regions on
 *              the GPU, using Tom's original 10,000-frame movement table.
 */
export const FRAG = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 outColor;

uniform sampler2D uIndices;
uniform sampler2D uPalette;
uniform float uOffset;     // palette rotation, in entries (continuous)
uniform float uTime;       // seconds
uniform int   uMode;       // 0 = palette-cycled indexed, 1 = sines, 2 = direct indexed
uniform float uScale;      // sine frequency
uniform float uAspect;     // width / height
uniform vec2  uOutputSize;
uniform vec2  uTomA;
uniform vec2  uTomB;
uniform bool  uTomSwim;
uniform bool  uSmooth;
uniform float uGlow;
uniform int   uPattern;    // Plasma Lab: 0..4 waves, 5..7 fractals, 8 fractal swim
uniform int   uFinish;     // Plasma Lab: 0 clean, 1 neon bloom, 2 dreamy trails
uniform float uMotion;
uniform float uIntensity;
uniform vec2  uAudio;      // smoothed bass and mid-band energy, 0..1
uniform bool  uLooping;
uniform float uLoopCycles;

const float CYCLE_START = 1.0;
const float CYCLE_COUNT = 192.0;
const float PI = 3.141592653589793;
const float TWO_PI = 6.283185307179586;

vec3 pal(float idx) {
  return texture(uPalette, vec2((idx + 0.5) / 256.0, 0.5)).rgb;
}

// rotatePalette(), as a lookup. Entry 0 is the background and never rotates.
//
// floor() is load-bearing: uOffset is continuous, so without it the rotated
// index lands anywhere in [1, 193) and NEAREST rounds the top of that range up
// into texel 193 -- an entry the 192-slot wheel never defines, which renders as
// black speckles. Flooring pins the result to exactly 1..192 and makes the
// rotation step discrete, which is what the VGA DAC actually did.
vec3 cycled(float idx) {
  if (idx < 0.5) return pal(0.0);
  float rotated = mod(idx - CYCLE_START + uOffset, CYCLE_COUNT) + CYCLE_START;
  float r = uSmooth ? rotated : floor(rotated);
  return pal(r);
}

float sampleIndex(vec2 topLeftUV) {
  return texture(uIndices, vec2(topLeftUV.x, 1.0 - topLeftUV.y)).r * 255.0;
}

// In loop mode uTime is a 0..2PI phase. Quantized harmonics guarantee that
// every term reaches the same value at the loop boundary.
float motionTime(float rawTime, float rate) {
  if (uLooping) return rawTime * uLoopCycles * max(1.0, floor(rate * 2.0 + 0.5));
  return rawTime * uMotion * rate;
}

float noiseHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  vec2 blend = local * local * (3.0 - 2.0 * local);
  float a = noiseHash(cell);
  float b = noiseHash(cell + vec2(1.0, 0.0));
  float c = noiseHash(cell + vec2(0.0, 1.0));
  float d = noiseHash(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
}

float fractalPlasma(vec2 p) {
  float total = 0.0;
  float amplitude = 0.54;
  mat2 turn = mat2(0.82, -0.57, 0.57, 0.82);
  for (int octave = 0; octave < 5; octave++) {
    total += valueNoise(p) * amplitude;
    p = turn * p * 2.03 + vec2(13.7, 9.2);
    amplitude *= 0.49;
  }
  return total / 1.035;
}

vec2 complexSquare(vec2 z) {
  return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
}

// Parameter-space escape coloring. The memory variant implements the attached
// second-order recurrence exactly: z(n+1) = z(n)^2 + z(n-1) + c.
float mandelbrotValue(vec2 c, bool withMemory) {
  vec2 z = vec2(0.0);
  vec2 previous = vec2(0.0);
  float escapedAt = 72.0;
  bool escaped = false;
  for (int i = 0; i < 72; i++) {
    vec2 next = complexSquare(z) + c;
    if (withMemory) next += previous;
    previous = z;
    z = next;
    if (dot(z, z) > 256.0) {
      escapedAt = float(i);
      escaped = true;
      break;
    }
  }
  if (!escaped) return -2.0; // marker: render the bounded set as deep black

  float smoothIteration = escapedAt + 1.0 - log2(max(1.0, log2(length(z))));
  float depth = pow(clamp(smoothIteration / 72.0, 0.0, 1.0), 0.38);
  float bands = 0.5 + 0.5 * cos(smoothIteration * 0.62);
  float shade = clamp(depth * 0.84 + bands * 0.20, 0.0, 1.0);
  return shade * 2.0 - 1.0;
}

// A higher-detail escape pass with emphatic iteration bands. Those bands form
// the striped ribbons visible while the camera moves through the recurrence.
float memoryTunnelValue(vec2 c) {
  vec2 z = vec2(0.0);
  vec2 previous = vec2(0.0);
  float escapedAt = 96.0;
  bool escaped = false;
  for (int i = 0; i < 96; i++) {
    vec2 next = complexSquare(z) + previous + c;
    previous = z;
    z = next;
    if (dot(z, z) > 256.0) {
      escapedAt = float(i);
      escaped = true;
      break;
    }
  }
  if (!escaped) return -2.0;

  float smoothIteration = escapedAt + 1.0 - log2(max(1.0, log2(length(z))));
  float depth = pow(clamp(smoothIteration / 96.0, 0.0, 1.0), 0.32);
  float broadBand = 0.5 + 0.5 * cos(smoothIteration * 1.08);
  float fineBand = 0.5 + 0.5 * cos(smoothIteration * 2.16 + 0.8);
  float shade = clamp(depth * 0.34 + pow(broadBand, 0.58) * 0.58 + fineBand * 0.12, 0.0, 1.0);
  return shade * 2.0 - 1.0;
}

float tunnelProgress(float rawTime) {
  if (uLooping) return fract((rawTime / TWO_PI) * uLoopCycles);
  return fract(rawTime * uMotion * 0.065);
}

float memoryTunnelLayer(vec2 centred, float phase, float baseZoom) {
  float zoom = baseZoom * exp2(phase * 8.0) * (1.0 + uAudio.x * 0.48);
  float turn = phase * 1.35 + sin(phase * TWO_PI) * 0.12;
  mat2 rotation = mat2(cos(turn), -sin(turn), sin(turn), cos(turn));
  float approach = 1.0 - exp2(-phase * 3.0);
  vec2 focus = vec2(-0.18, 0.0) + vec2(0.008, -0.004) * approach;
  vec2 c = focus + rotation * centred * (1.85 / zoom);
  return memoryTunnelValue(c);
}

float demosceneValue(vec2 uv, float rawTime) {
  float t = motionTime(rawTime, 1.0);
  float scale = uScale * (1.0 + uAudio.x * 0.22);
  float energy = 1.0 + uAudio.y * 0.18;
  vec2 p = vec2(uv.x * uAspect, uv.y);

  if (uPattern == 8) {
    // An original high-resolution homage to Tom's rough fractal. Multiple
    // views into the same procedural surface drift and combine cyclically as
    // one continuous field, without reproducing the historical inset window.
    float frequency = max(2.0, scale * 0.34);
    vec2 centred = vec2((uv.x - 0.5) * uAspect, uv.y - 0.5);
    float base = fractalPlasma(centred * frequency + vec2(6.4, 11.7));
    float driftTime = motionTime(rawTime, 0.34);
    vec2 driftA = vec2(cos(driftTime * 0.83), sin(driftTime * 1.07)) * 0.72;
    vec2 driftB = vec2(sin(driftTime * 0.71), cos(driftTime * 0.91)) * 0.68;
    float layerA = fractalPlasma(centred * frequency * 1.12 + driftA + vec2(6.4, 11.7));
    float layerB = fractalPlasma(centred * frequency * 0.88 + driftB + vec2(9.1, 4.8));
    float swimming = fract(base * 0.35 + layerA * 0.78 + layerB * 0.64);
    return (mix(base, swimming, 0.72) * 2.0 - 1.0) * energy;
  }

  // Pattern 0 is the original shader, kept verbatim apart from normalization.
  if (uPattern == 0) {
    float v = sin(p.x * scale + t)
            + sin(p.y * scale * 0.8 + motionTime(rawTime, 1.3))
            + sin((p.x + p.y) * scale * 0.6 + motionTime(rawTime, 0.7))
            + sin(length(p - vec2(uAspect * 0.5, 0.5)) * scale * 1.4 - motionTime(rawTime, 1.1));
    return v * 0.25 * energy;
  }

  if (uPattern == 1) {
    // Domain warping: two slow waves bend the coordinates before evaluation.
    vec2 warp = vec2(
      sin(p.y * 5.1 + motionTime(rawTime, 0.74)) + sin((p.x + p.y) * 2.3 - motionTime(rawTime, 0.41)),
      cos(p.x * 4.4 - motionTime(rawTime, 0.63)) + cos((p.x - p.y) * 2.7 + motionTime(rawTime, 0.52))
    ) * 0.085;
    vec2 q = p + warp;
    float v = sin(q.x * scale * 0.82 + motionTime(rawTime, 0.9))
            + sin(q.y * scale * 1.08 - motionTime(rawTime, 1.16))
            + sin((q.x + q.y) * scale * 0.57 + motionTime(rawTime, 0.61))
            + cos(length(q - vec2(uAspect * 0.5, 0.5)) * scale * 1.7 - motionTime(rawTime, 0.83));
    return v * 0.25 * energy;
  }

  vec2 centred = vec2((uv.x - 0.5) * uAspect, uv.y - 0.5);
  if (uPattern == 7) {
    float progress = tunnelProgress(rawTime);
    float baseZoom = exp2((scale - 8.0) * 0.16);
    float current = memoryTunnelLayer(centred, progress, baseZoom);

    // The restart layer follows the same forward path one zoom-span behind.
    // It appears only near the end, hiding the finite-precision reset while
    // making phase 0 and phase 1 identical for perfect-loop recording.
    float restart = memoryTunnelLayer(centred, progress - 1.0, baseZoom);
    float resetBlend = smoothstep(0.84, 1.0, progress);
    bool currentBounded = current < -1.5;
    bool restartBounded = restart < -1.5;
    if (currentBounded && restartBounded) return -2.0;
    float currentShade = currentBounded ? -1.0 : current;
    float restartShade = restartBounded ? -1.0 : restart;
    return clamp(mix(currentShade, restartShade, resetBlend) * energy, -1.0, 1.0);
  }

  if (uPattern == 5 || uPattern == 6) {
    bool withMemory = uPattern == 6;
    float breath = 0.5 - 0.5 * cos(motionTime(rawTime, withMemory ? 0.24 : 0.18));
    // The existing Frequency control becomes an exponential fractal zoom: 8
    // shows the complete set, while the upper range reaches fine boundary detail.
    float baseZoom = exp2((scale - 8.0) * 0.16);
    float zoom = baseZoom * (1.0 + breath * (withMemory ? 0.55 : 0.34)) * (1.0 + uAudio.x * 0.45);
    float turn = sin(motionTime(rawTime, withMemory ? 0.13 : 0.09)) * (withMemory ? 0.16 : 0.025);
    mat2 rotation = mat2(cos(turn), -sin(turn), sin(turn), cos(turn));
    vec2 focus = withMemory ? vec2(-0.18, 0.0) : vec2(-0.52, 0.0);
    vec2 c = focus + rotation * centred * (1.85 / zoom);
    float value = mandelbrotValue(c, withMemory);
    return value < -1.5 ? value : clamp(value * energy, -1.0, 1.0);
  }

  float radius = length(centred);
  float angle = atan(centred.y, centred.x);
  if (uPattern == 2) {
    float v = sin(radius * scale * 2.4 - angle * 5.0 - motionTime(rawTime, 1.2))
            + sin(radius * scale * 1.15 + angle * 3.0 + motionTime(rawTime, 0.73))
            + cos(centred.x * scale * 0.75 + motionTime(rawTime, 0.91))
            + sin(centred.y * scale * 0.92 - motionTime(rawTime, 1.07));
    return v * 0.25 * energy;
  }

  if (uPattern == 3) {
    // Six mirrored wedges form a radial kaleidoscope before feeding the field.
    float wedge = PI / 3.0;
    float folded = abs(mod(angle + wedge * 0.5, wedge) - wedge * 0.5);
    vec2 kaleido = vec2(cos(folded), sin(folded)) * radius;
    float v = sin(kaleido.x * scale * 1.4 + t)
            + sin(kaleido.y * scale * 2.2 - motionTime(rawTime, 1.18))
            + cos(radius * scale * 2.8 - motionTime(rawTime, 0.72))
            + sin((kaleido.x + kaleido.y) * scale * 0.9 + motionTime(rawTime, 0.54));
    return v * 0.25 * energy;
  }

  // A deliberate twelve-petal rosette with concentric lace and a slow breath.
  // Unlike Kaleidoscope, this is constructed radially instead of mirroring a field.
  float breathingRadius = radius * (1.0 + 0.055 * sin(motionTime(rawTime, 0.65)));
  float petals = abs(cos(angle * 6.0 + sin(motionTime(rawTime, 0.24)) * 0.10));
  float rosette = sin(breathingRadius * scale * 2.0 - petals * 2.8 + motionTime(rawTime, 0.25));
  float rings = cos(breathingRadius * scale * 5.2 - motionTime(rawTime, 0.40));
  float lace = sin(breathingRadius * scale * 3.15 + cos(angle * 12.0) * 1.15 + motionTime(rawTime, 0.18));
  float centre = cos(breathingRadius * scale * 1.15 + petals * PI - motionTime(rawTime, 0.28));
  float v = rosette + rings + lace + centre;
  return v * 0.25 * energy;
}

float fieldIndex(vec2 uv, float time) {
  float idx;
  if (uMode == 0 || uMode == 2) {
    idx = sampleIndex(uv);
  } else if (uMode == 3 || uMode == 4) {
    idx = sampleIndex(uv);
    vec2 windowMin = vec2(90.0 / 320.0, 50.0 / 200.0);
    vec2 windowSize = vec2(0.5);
    if (uTomSwim && all(greaterThanEqual(uv, windowMin)) &&
        all(lessThan(uv, windowMin + windowSize))) {
      vec2 local = (uv - windowMin) / windowSize;
      float a = sampleIndex(uTomA * 0.5 + local * 0.5);
      float b = sampleIndex(uTomB * 0.5 + local * 0.5);
      idx = mod(floor(a + 0.5) + floor(b + 0.5), 256.0);
    }
  } else {
    float raw = demosceneValue(uv, time);
    if (uPattern >= 5 && raw < -1.5) {
      idx = 0.0;
    } else {
      float v = clamp(raw * uIntensity, -1.0, 1.0);
      idx = CYCLE_START + (v * 0.5 + 0.5) * (CYCLE_COUNT - 1.0);
    }
  }
  return idx;
}

vec3 colorAt(vec2 uv, float time) {
  float idx = fieldIndex(clamp(uv, vec2(0.0), vec2(1.0)), time);
  if (uMode == 1 && uPattern >= 5 && idx < 0.5) return vec3(0.002, 0.003, 0.008);
  return (uMode == 2 || uMode == 3) ? pal(idx) : cycled(idx);
}

void main() {
  vec3 color = colorAt(vUV, uTime);
  if (uMode == 1 && uFinish == 2 && uPattern < 5) {
    // Deterministic temporal echoes give trails without sacrificing PNG export.
    vec2 drift = vec2(cos(motionTime(uTime, 0.31)), sin(motionTime(uTime, 0.37))) * (0.006 * uMotion);
    vec3 echo1 = colorAt(vUV - drift, uTime - 0.10);
    vec3 echo2 = colorAt(vUV - drift * 2.1, uTime - 0.22);
    vec3 echo3 = colorAt(vUV - drift * 3.4, uTime - 0.38);
    color = max(color, echo1 * 0.76);
    color = max(color, echo2 * 0.53);
    color = max(color, echo3 * 0.34);
    color = max(color, vec3(echo1.r, echo2.g, echo3.b) * 0.68);
    color += (echo1 + echo2 + echo3) * 0.035;
  }
  if (uMode == 1 && uFinish == 1 && uPattern < 5) {
    vec2 nearStep = 2.5 / uOutputSize;
    vec2 farStep = 7.0 / uOutputSize;
    vec3 bloom = colorAt(vUV + vec2(nearStep.x, 0.0), uTime)
               + colorAt(vUV - vec2(nearStep.x, 0.0), uTime)
               + colorAt(vUV + vec2(0.0, nearStep.y), uTime)
               + colorAt(vUV - vec2(0.0, nearStep.y), uTime)
               + colorAt(vUV + farStep, uTime)
               + colorAt(vUV - farStep, uTime)
               + colorAt(vUV + vec2(farStep.x, -farStep.y), uTime)
               + colorAt(vUV + vec2(-farStep.x, farStep.y), uTime);
    bloom *= 0.125;
    color = color * 1.08 + max(bloom - vec3(0.28), vec3(0.0)) * 0.62;
  }
  if (uMode == 1 && uPattern >= 5 && uFinish == 1) {
    // A one-pass luminous finish avoids re-running the fractal for eight taps.
    color = color * 1.04 + max(color - vec3(0.50), vec3(0.0)) * 0.22;
  }
  if (uMode == 1 && uPattern >= 5 && uFinish == 2) {
    // Chromatic persistence suggests a ghosted prior state without multiplying
    // the expensive recurrence per pixel.
    color = max(color, vec3(color.b, color.r, color.g) * 0.42);
    color += vec3(color.g, color.b, color.r) * 0.06;
  }
  if (uGlow > 0.0 && !(uMode == 1 && uPattern >= 5)) {
    vec2 stepUV = 2.0 / uOutputSize;
    vec3 blur = colorAt(vUV + vec2(stepUV.x, 0.0), uTime)
              + colorAt(vUV - vec2(stepUV.x, 0.0), uTime)
              + colorAt(vUV + vec2(0.0, stepUV.y), uTime)
              + colorAt(vUV - vec2(0.0, stepUV.y), uTime);
    blur *= 0.25;
    color += max(blur - vec3(0.35), vec3(0.0)) * (0.28 * uGlow);
  }
  if (uGlow > 0.0 && uMode == 1 && uPattern >= 5) {
    color += max(color - vec3(0.30), vec3(0.0)) * (0.22 * uGlow);
  }
  outColor = vec4(min(color, vec3(1.0)), 1.0);
}`
