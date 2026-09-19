# Plasma Generator

Two restored plasma engines and the modern Plasma Lab collection of generative
visuals, built in TypeScript + WebGL2 with no framework or runtime dependencies.

```bash
yarn install
yarn dev        # http://localhost:5173
yarn build      # -> dist/
```

## Plasma types

| Type | What it is | What moves |
|---|---|---|
| **Plasma Lab** | Our modern collection of selectable procedural fields computed in the fragment shader. | The field itself. |
| **Mulvey 1988** | Diamond-square ported from `PLASMA.PAS`; choose a newly generated image or the archived `PLASMA.IMG`. | The palette; the field stays fixed. |
| **Tom's 1994** | Tom Dibble's fractal plus the original two-window "swimming" compositor. | Two source windows and a 1,024-entry palette sequence. |

## Plasma Lab patterns and finishes

Plasma Lab opens first in Modern HD with **Ice Flow**, a clean Classic Sines scene
using the cool-toned Ice palette. **Fractal Swim**, an original GPU homage to Tom's
rough fractal texture, remains available alongside seven other GPU-native fields:

| Pattern | Character |
|---|---|
| **Fractal Swim** | Multi-scale procedural plasma whose drifting layers blend across the full canvas. |
| **Classic Sines** | The original four-wave plasma. |
| **Liquid Warp** | A second wave field bends the sampling domain into fluid forms. |
| **Vortex** | Radial and angular waves produce rotating spiral interference. |
| **Kaleidoscope** | Six mirrored wedges produce animated radial symmetry. |
| **Mandala** | A centered twelve-petal rosette with concentric rings and slow breathing motion. |
| **Classic Mandelbrot** | The recognizable quadratic set, palette-colored with a gentle looping zoom. |
| **Memory Mandelbrot** | A second-order variation where the prior value remains in the recurrence: `z(n+1) = z(n)² + z(n-1) + c`. |
| **Memory Tunnel** | The same recurrence with a forward-only exponential camera, stronger iteration ribbons, and a seamless restart blend. |

Each can use a **Clean**, **Neon Bloom**, or **Dreamy Trails** finish. Trails use
deterministic time-offset and spatially-offset shader samples, so paused frames and
PNG exports remain reproducible. Motion, intensity, frequency, palette, cycle speed,
sampling, and output profile remain independent controls.

The generator also includes seeded **Surprise Me** scenes, six-stop custom
palettes, and 5/10/20-second loop-aware timing.

Microphone reaction is implemented but **disabled** behind `AUDIO_REACTION_ENABLED`
in `src/main.ts`. It analyzes bass and midrange energy in memory to influence the
shader — audio is never uploaded, saved, or included in WebM exports — but at
realistic room levels the current coefficients move the field only a few percent,
so it is hidden until the gains and smoothing are retuned. Enabling the flag also
restores the microphone level readout in the diagnostics panel.

Four curated, seamless palette wheels evoke well-known painted color themes without
sampling any particular reproduction: **Starry Night–inspired**, **Sunflowers–inspired**,
**Irises–inspired**, and **Café Terrace–inspired**. Starry Night deliberately devotes
most of its 192 entries to navy, cobalt, and turquoise, reserving narrow ochre and ivory
bands for luminous highlights.

**Tunnel Blue & Gold** is a dedicated ribbon palette alternating midnight blue,
icy cyan, ivory, ochre, and burgundy for dimensional deep-zoom banding.

The Plasma Lab **Scene** menu supplies editable combinations rather than introducing a
second kind of state: Starry Vortex, Starry Mandala, Celestial Trails, Sunflower Heat,
Irises in Motion, Café Terrace Glow, Mandelbrot Voyage, Memory Spiral, and Memory
Tunnel simply populate the normal pattern, finish, palette, frequency/zoom,
motion, intensity, and speed controls. Changing any constituent control returns
the menu to Custom, and the complete result remains represented by the URL.

For all three fractal patterns the Frequency control becomes an exponential **Zoom / detail**
control. Their bloom, trails, and glow treatments use single-pass color finishing
so the complex recurrence is not needlessly evaluated many times per output pixel.
Memory Tunnel raises the recurrence to 96 iterations and blends in a second copy
of the same forward camera only near the finite-precision reset. This avoids a
backward zoom or hard cut while keeping loop-aware recordings seamless.

## Render profiles

The render profile applies to all three engines. Plasma Lab defaults to Modern HD;
the two historical modes default to Authentic VGA, and each mode remembers its
most recently selected profile and sampling while you move between tabs:

| Profile | Output | Display | Generator behavior |
|---|---:|---:|---|
| **Authentic VGA** | 320×200 | 4:3 VGA pixel aspect | Exact historical Mulvey/Tom paths; nearest-neighbor by default. |
| **Modern HD** | 1920×1080 | 16:9 | Native widescreen fields and GPU rendering. |
| **Modern UHD** | 3840×2160 | 16:9 | Native 4K fields and PNG export. |

Sampling is independently selectable as pixel-perfect, smooth, or smooth with
a subtle four-tap glow. The archived `PLASMA.IMG` is intrinsically 320×200, so
modern profiles upscale that artifact; newly generated Mulvey fields are truly
generated at the selected output size. Plasma Lab is always evaluated per
output pixel. Tom opens with its full fractal visible and the optional historical
swim window switched off.

**Live preview quality** can reduce GPU load without reducing PNG or WebM output:
exports temporarily render at the selected profile's full dimensions. An optional
FPS overlay makes the tradeoff visible.

## Sharing, recording, and installation

- **Copy share link** encodes every reproducible scene control in the URL.
- **Save/Load preset** exports that validated state as a small versioned JSON file.
- **Reset defaults** restores the selected generator to its clean-launch defaults:
  Modern HD and smooth sampling for Plasma Lab, or Authentic VGA and pixel-perfect
  sampling for Mulvey and Tom, including a fresh generated seed where applicable.
- **Record WebM** captures 5, 10, or 20 seconds from the canvas. When a Plasma Lab
  loop is active, shader harmonics and palette cycling meet at the loop boundary.
- **Presentation** (`H`) hides the interface without requiring the browser's
  fullscreen permission; fullscreen (`F`) remains available for all three engines.
- The production build registers a service worker and can be installed as an
  offline-capable PWA after its first successful load.
- Reduced-motion preferences start the animation paused. A lost WebGL context is
  reported and the scene reloads after the browser restores it.

Tom's mode uses the untouched 108,608-byte `TOMSPLAS.DAT` from the 1994 archive
(SHA-256 `8628b181...d596d`). The browser parses its 10,000 movement pairs, four
VGA palettes, and 64 KiB random table. The fractal generator, packed 32-bit
window addition, four-byte second-pointer offset, and palette rotation follow
`TPLAS.ASM` 1.1. Tom Dibble is credited in the UI/source in accordance with the
permission notice in `TPLAS.DOC`.

## Why WebGL is the right fit

Mulvey-style palette cycling is a texture lookup, so the port uses the same
indirection as the VGA DAC:

```glsl
float idx = texture(uIndices, vUV).r * 255.0;
float r   = floor(mod(idx - 1.0 + uOffset, 192.0)) + 1.0;
outColor  = vec4(texture(uPalette, vec2((r + 0.5) / 256.0, 0.5)).rgb, 1.0);
```

In Authentic VGA, Tom's mode updates a 320×200 `R8` texture as its 160×100
swimming window moves and preserves the original packed-addition carry. Modern
Tom generates a native-resolution fractal from the DAT random stream, normalizes
the same 10,000 movement pairs, and composites its half-frame window on the GPU
with clean per-pixel addition. Both use the original 1,024-entry palette sequence.
Plasma Lab computes its selected field and finish directly in the shader. Its internal
`demoscene` URL identifier is retained so existing shared links and presets keep working.

## Fidelity verification

The verification script checks both generators, the canonical DAT hash and
layout, deterministic Tom output, compositor bounds, movement, and palette:

```bash
yarn test:generator
yarn test:visual
```

The Playwright suite adds deterministic canvas screenshot baselines. Use
`yarn test:visual:update` only for an intentional rendering change.

The Mulvey port preserves its index-0 sentinel and undisplaced centre. Tom's
port preserves the original roughness masks (`255`, `127`, `63`) and the packed
addition carry between neighbouring pixels described in Tom's manual.

## Shareable state and keys

Every control round-trips through the query string:

```text
?type=tom&profile=hd&sampling=glow&tseed=0x1234&tr=255&swim=1&tpal=tom&spd=24
?type=mulvey&src=original&profile=authentic&sampling=pixel&pal=mulvey&spd=24
?type=demoscene&profile=hd&pattern=kaleidoscope&finish=bloom&motion=1.2&intensity=1.1
?type=demoscene&profile=hd&pal=starryNight&pattern=vortex&finish=bloom&sc=12&motion=0.8&intensity=1.1&spd=18
?type=demoscene&profile=hd&pal=starryNight&pattern=mandala&finish=bloom&sc=10&motion=0.6&intensity=1.1&spd=12
```

The old `?tab=mulvey`, `?tab=original`, and `?tab=demoscene` links remain
compatible.

Keys: `space` pause · `f` enter/exit fullscreen · `h` presentation · `n` new plasma · `w` toggle
Tom's swim window · Tom's original `1`–`3` smoothness controls. Fullscreen works
for every engine and keeps the selected profile's 4:3 or 16:9 display aspect.

## Attribution and licensing

The complete original archives and historical source trees are intentionally not
part of the public repository. See the root `THIRD_PARTY_NOTICES.md` for Bret
Mulvey and Tom Dibble credits, Tom's reuse conditions, the swimming-effect lineage,
and the unresolved pre-release permission gate for Mulvey-derived material.
