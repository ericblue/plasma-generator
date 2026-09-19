import { generateDiamondSquare } from './generators/diamondSquare'
import {
  parseTomsPlasmaData,
  TOM_FRAME_COUNT,
  TOM_HEIGHT,
  TOM_WIDTH,
  TomsPlasmaEngine,
  TomsPlasmaModernEngine,
  type TomMovement,
  type TomsPlasmaData,
  type TomRoughness,
} from './generators/tomsPlasma'
import { PlasmaRenderer, type RenderMode } from './gl/renderer'
import {
  buildPalette,
  buildPaletteFromHexStops,
  DEFAULT_CUSTOM_COLORS,
  PALETTE_LABELS,
  type PaletteName,
} from './palette'
import { formatSeed, mulberry32, parseSeed, randomSeed } from './rng'

type PlasmaType = 'mulvey' | 'tom' | 'demoscene'
type MulveySource = 'generated' | 'original'
type TomPalette = 'tom' | PaletteName
type RenderProfile = 'authentic' | 'hd' | 'uhd'
type SamplingMode = 'pixel' | 'smooth' | 'glow'
type PreviewQuality = 'full' | 'balanced' | 'performance'
type LoopSeconds = 0 | 5 | 10 | 20
type DemoscenePattern =
  | 'fractalSwim' | 'classic' | 'liquid' | 'vortex' | 'kaleidoscope' | 'mandala'
  | 'mandelbrot' | 'memoryMandelbrot' | 'memoryTunnel'
type DemosceneFinish = 'clean' | 'bloom' | 'trails'
type DemosceneScene =
  | 'iceFlow' | 'fractalSwim' | 'starryVortex' | 'starryMandala' | 'celestialTrails' | 'sunflowerHeat'
  | 'irisesInMotion' | 'cafeTerraceGlow' | 'mandelbrotVoyage' | 'memorySpiral'
  | 'memoryTunnel'

const RENDER_PROFILES: Record<RenderProfile, { label: string; w: number; h: number; aspect: number }> = {
  authentic: { label: 'Authentic VGA', w: 320, h: 200, aspect: 4 / 3 },
  hd: { label: 'Modern HD', w: 1920, h: 1080, aspect: 16 / 9 },
  uhd: { label: 'Modern UHD', w: 3840, h: 2160, aspect: 16 / 9 },
}

const DEMO_PATTERN_LABELS: Record<DemoscenePattern, string> = {
  fractalSwim: 'Fractal Swim',
  classic: 'Classic Sines',
  liquid: 'Liquid Warp',
  vortex: 'Vortex',
  kaleidoscope: 'Kaleidoscope',
  mandala: 'Mandala',
  mandelbrot: 'Classic Mandelbrot',
  memoryMandelbrot: 'Memory Mandelbrot',
  memoryTunnel: 'Memory Tunnel',
}

const DEMO_FINISH_LABELS: Record<DemosceneFinish, string> = {
  clean: 'Clean',
  bloom: 'Neon Bloom',
  trails: 'Dreamy Trails',
}

const DEMO_PATTERN_INDEX: Record<DemoscenePattern, number> = {
  classic: 0, liquid: 1, vortex: 2, kaleidoscope: 3, mandala: 4,
  mandelbrot: 5, memoryMandelbrot: 6, memoryTunnel: 7,
  fractalSwim: 8,
}

const DEMO_FINISH_INDEX: Record<DemosceneFinish, number> = {
  clean: 0, bloom: 1, trails: 2,
}

interface DemosceneSceneSettings {
  label: string
  pattern: DemoscenePattern
  finish: DemosceneFinish
  palette: PaletteName
  frequency: number
  motion: number
  intensity: number
  speed: number
}

const DEMO_SCENES: Record<DemosceneScene, DemosceneSceneSettings> = {
  iceFlow: {
    label: 'Ice Flow', pattern: 'classic', finish: 'clean', palette: 'ice',
    frequency: 9, motion: 0.6, intensity: 0.9, speed: 19,
  },
  fractalSwim: {
    label: 'Fractal Swim', pattern: 'fractalSwim', finish: 'clean', palette: 'vgaCandy',
    frequency: 11, motion: 0.7, intensity: 1, speed: 24,
  },
  starryVortex: {
    label: 'Starry Vortex', pattern: 'vortex', finish: 'bloom', palette: 'starryNight',
    frequency: 12, motion: 0.8, intensity: 1.1, speed: 18,
  },
  starryMandala: {
    label: 'Starry Mandala', pattern: 'mandala', finish: 'bloom', palette: 'starryNight',
    frequency: 10, motion: 0.6, intensity: 1.1, speed: 12,
  },
  celestialTrails: {
    label: 'Celestial Trails', pattern: 'liquid', finish: 'trails', palette: 'starryNight',
    frequency: 9, motion: 0.7, intensity: 1, speed: 14,
  },
  sunflowerHeat: {
    label: 'Sunflower Heat', pattern: 'kaleidoscope', finish: 'bloom', palette: 'sunflowers',
    frequency: 14, motion: 1.1, intensity: 1.2, speed: 30,
  },
  irisesInMotion: {
    label: 'Irises in Motion', pattern: 'liquid', finish: 'clean', palette: 'irises',
    frequency: 11, motion: 0.6, intensity: 0.9, speed: 18,
  },
  cafeTerraceGlow: {
    label: 'Café Terrace Glow', pattern: 'classic', finish: 'bloom', palette: 'cafeTerrace',
    frequency: 10, motion: 0.8, intensity: 1.1, speed: 20,
  },
  mandelbrotVoyage: {
    label: 'Mandelbrot Voyage', pattern: 'mandelbrot', finish: 'clean', palette: 'starryNight',
    frequency: 8, motion: 0.5, intensity: 1.1, speed: 9,
  },
  memorySpiral: {
    label: 'Memory Spiral', pattern: 'memoryMandelbrot', finish: 'bloom', palette: 'starryNight',
    frequency: 28, motion: 0.5, intensity: 1.2, speed: 10,
  },
  memoryTunnel: {
    label: 'Memory Tunnel', pattern: 'memoryTunnel', finish: 'bloom', palette: 'tunnelBlueGold',
    frequency: 20, motion: 0.8, intensity: 1.2, speed: 8,
  },
}

interface State {
  type: PlasmaType
  mulveySource: MulveySource
  seed: number
  roughness: number
  renderProfile: RenderProfile
  sampling: SamplingMode
  palette: PaletteName
  speed: number
  sineScale: number
  demoPattern: DemoscenePattern
  demoFinish: DemosceneFinish
  demoMotion: number
  demoIntensity: number
  centreDisplacement: boolean
  tomSeed: number
  tomRoughness: TomRoughness
  tomSwim: boolean
  tomPalette: TomPalette
  paused: boolean
  previewQuality: PreviewQuality
  loopSeconds: LoopSeconds
  customColors: string[]
  surpriseSeed: number | null
}

function createDefaultState(type: PlasmaType): State {
  const modern = type === 'demoscene'
  return {
    type,
    mulveySource: 'generated',
    seed: randomSeed(),
    roughness: 2,
    renderProfile: modern ? 'hd' : 'authentic',
    sampling: modern ? 'smooth' : 'pixel',
    palette: modern ? 'ice' : 'mulvey',
    speed: modern ? 19 : 24,
    sineScale: 9,
    demoPattern: 'classic',
    demoFinish: 'clean',
    demoMotion: 0.6,
    demoIntensity: 0.9,
    centreDisplacement: false,
    tomSeed: randomSeed() & 0xffff,
    tomRoughness: 255,
    tomSwim: false,
    tomPalette: 'tom',
    paused: matchMedia('(prefers-reduced-motion: reduce)').matches,
    previewQuality: 'balanced',
    loopSeconds: 0,
    customColors: [...DEFAULT_CUSTOM_COLORS],
    surpriseSeed: null,
  }
}

const typeSlug = (type: PlasmaType): string => type === 'demoscene' ? 'plasma-lab' : type

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`missing element #${id}`)
  return el as T
}

const isPaletteName = (value: string | null): value is PaletteName =>
  value !== null && value in PALETTE_LABELS

const isRenderProfile = (value: string | null): value is RenderProfile =>
  value === 'authentic' || value === 'hd' || value === 'uhd'

const isSamplingMode = (value: string | null): value is SamplingMode =>
  value === 'pixel' || value === 'smooth' || value === 'glow'

const isPreviewQuality = (value: string | null): value is PreviewQuality =>
  value === 'full' || value === 'balanced' || value === 'performance'

const loopSecondsParam = (value: string | null): LoopSeconds =>
  value === '5' ? 5 : value === '10' ? 10 : value === '20' ? 20 : 0

const validHexColor = (value: string): boolean => /^#[0-9a-f]{6}$/i.test(value)

function colorsParam(value: string | null): string[] {
  const colors = value?.split(',').map((color) => color.startsWith('#') ? color : `#${color}`)
  return colors?.length === 6 && colors.every(validHexColor)
    ? colors.map((color) => color.toLowerCase())
    : [...DEFAULT_CUSTOM_COLORS]
}

const isDemoscenePattern = (value: string | null): value is DemoscenePattern =>
  value === 'fractalSwim' || value === 'classic' || value === 'liquid' || value === 'vortex' ||
  value === 'kaleidoscope' || value === 'mandala' || value === 'mandelbrot' ||
  value === 'memoryMandelbrot' || value === 'memoryTunnel'

const isDemosceneFinish = (value: string | null): value is DemosceneFinish =>
  value === 'clean' || value === 'bloom' || value === 'trails'

const numberParam = (value: string | null, fallback: number): number => {
  if (value === null || value.trim() === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const tomRoughnessParam = (value: string | null): TomRoughness =>
  value === '127' ? 127 : value === '63' ? 63 : 255

const formatTomSeed = (seed: number): string =>
  `0x${(seed & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`

const parseTomSeed = (value: string): number | null => {
  const parsed = parseSeed(value)
  return parsed === null ? null : parsed & 0xffff
}

// ---------------------------------------------------------------- URL state
function readState(): State {
  const q = new URLSearchParams(location.search)
  const legacyTab = q.get('tab')
  const requestedType = q.get('type') ?? legacyTab
  const type: PlasmaType = requestedType === 'mulvey' || requestedType === 'tom' || requestedType === 'demoscene'
    ? requestedType
    : legacyTab === 'original' ? 'mulvey' : 'demoscene'
  const defaults = createDefaultState(type)
  const mulveySource: MulveySource = q.get('src') === 'original' || legacyTab === 'original'
    ? 'original'
    : 'generated'
  const paletteParam = q.get('pal')
  const tomPaletteParam = q.get('tpal')
  const legacyResolution = Math.floor(numberParam(q.get('res'), 0))
  const requestedProfile = q.get('profile')
  const renderProfile: RenderProfile = isRenderProfile(requestedProfile)
    ? requestedProfile
    : legacyResolution > 0 ? 'hd' : defaults.renderProfile
  const requestedSampling = q.get('sampling')
  const requestedPattern = q.get('pattern')
  const requestedFinish = q.get('finish')
  const requestedQuality = q.get('quality')

  return {
    type,
    mulveySource,
    seed: parseSeed(q.get('seed') ?? '') ?? defaults.seed,
    roughness: numberParam(q.get('f'), defaults.roughness),
    renderProfile,
    sampling: isSamplingMode(requestedSampling)
      ? requestedSampling
      : renderProfile === 'authentic' ? 'pixel' : 'smooth',
    palette: isPaletteName(paletteParam) ? paletteParam : defaults.palette,
    speed: Math.min(120, Math.max(0, numberParam(q.get('spd'), defaults.speed))),
    sineScale: numberParam(q.get('sc'), defaults.sineScale),
    demoPattern: isDemoscenePattern(requestedPattern) ? requestedPattern : defaults.demoPattern,
    demoFinish: isDemosceneFinish(requestedFinish) ? requestedFinish : defaults.demoFinish,
    demoMotion: Math.min(3, Math.max(0, numberParam(q.get('motion'), defaults.demoMotion))),
    demoIntensity: Math.min(2, Math.max(0.2, numberParam(q.get('intensity'), defaults.demoIntensity))),
    centreDisplacement: q.get('cd') === '1',
    tomSeed: (parseSeed(q.get('tseed') ?? '') ?? defaults.tomSeed) & 0xffff,
    tomRoughness: tomRoughnessParam(q.get('tr')),
    tomSwim: q.get('swim') === null ? defaults.tomSwim : q.get('swim') === '1',
    tomPalette: tomPaletteParam === 'tom' || isPaletteName(tomPaletteParam) ? tomPaletteParam : 'tom',
    paused: q.get('paused') === '1' || defaults.paused,
    previewQuality: isPreviewQuality(requestedQuality) ? requestedQuality : defaults.previewQuality,
    loopSeconds: loopSecondsParam(q.get('loop')),
    customColors: colorsParam(q.get('colors')),
    surpriseSeed: parseSeed(q.get('surprise') ?? ''),
  }
}

function writeState(s: State): void {
  const q = new URLSearchParams({
    type: s.type,
    src: s.mulveySource,
    seed: formatSeed(s.seed),
    f: String(s.roughness),
    profile: s.renderProfile,
    sampling: s.sampling,
    pal: s.palette,
    spd: String(s.speed),
    sc: String(s.sineScale),
    pattern: s.demoPattern,
    finish: s.demoFinish,
    motion: String(s.demoMotion),
    intensity: String(s.demoIntensity),
    cd: s.centreDisplacement ? '1' : '0',
    tseed: formatTomSeed(s.tomSeed),
    tr: String(s.tomRoughness),
    swim: s.tomSwim ? '1' : '0',
    tpal: s.tomPalette,
    paused: s.paused ? '1' : '0',
    quality: s.previewQuality,
    loop: String(s.loopSeconds),
    colors: s.customColors.map((color) => color.slice(1)).join(','),
  })
  if (s.surpriseSeed !== null) q.set('surprise', formatSeed(s.surpriseSeed))
  history.replaceState(null, '', `?${q}`)
}

// ---------------------------------------------------------------- boot and assets
const state = readState()
const modeRendering: Record<PlasmaType, { renderProfile: RenderProfile; sampling: SamplingMode }> = {
  mulvey: { renderProfile: 'authentic', sampling: 'pixel' },
  tom: { renderProfile: 'authentic', sampling: 'pixel' },
  demoscene: { renderProfile: 'hd', sampling: 'smooth' },
}
modeRendering[state.type] = { renderProfile: state.renderProfile, sampling: state.sampling }
const modePalettes: Record<'mulvey' | 'demoscene', PaletteName> = {
  mulvey: 'mulvey',
  demoscene: 'ice',
}
if (state.type !== 'tom') modePalettes[state.type] = state.palette
const canvas = $<HTMLCanvasElement>('view')

let renderer: PlasmaRenderer
try {
  renderer = new PlasmaRenderer(canvas)
} catch (err) {
  $('fatal').textContent = err instanceof Error ? err.message : String(err)
  $('fatal').hidden = false
  throw err
}

let originalImage: Uint8Array | null = null
let tomData: TomsPlasmaData | null = null
let tomEngine: TomsPlasmaEngine | null = null
let tomModernEngine: TomsPlasmaModernEngine | null = null
let tomMovement: TomMovement = { first: [0, 0], second: [0, 0] }
let genMs = 0
let tomGenMs = 0
let paletteOffset = 0
let tomFrame = 0
let tomFrameFraction = 0
let last = performance.now()
let animationTime = 0
// A paused scene is static, so redrawing it every frame just burns CPU/GPU --
// which on a battery is drain, and under software rasterization (CI, machines
// with blocklisted drivers) saturates the box badly enough to starve input.
// Draw when running, or when something changed while paused.
let needsRedraw = true
let forceFullResolution = false
let recording = false
let audioContext: AudioContext | null = null
let audioAnalyser: AnalyserNode | null = null
let audioStream: MediaStream | null = null
let audioData: Uint8Array<ArrayBuffer> | null = null
let audioEnergy: readonly [number, number] = [0, 0]
// Highest raw bass/mid reading since the last diagnostics refresh. Peaks are
// kept separately from audioEnergy so a short transient still shows up at the
// panel's 2 Hz cadence instead of being averaged away.
let audioPeak: [number, number] = [0, 0]
// Microphone reaction is complete but not yet tuned: at realistic room levels
// the shader coefficients in demosceneValue() move the field only a few
// percent, which reads as no response at all. The pipeline and the diagnostics
// readout are kept intact; only the entry point is hidden. Flip this to true to
// bring the control back once the gains and smoothing are retuned.
const AUDIO_REACTION_ENABLED = false
let fpsFrames = 0
let fpsSince = performance.now()
let fpsValue = 0

async function loadOriginal(): Promise<Uint8Array> {
  if (originalImage) return originalImage
  const res = await fetch(`${import.meta.env.BASE_URL}plasma-1988.img`)
  if (!res.ok) throw new Error(`could not load plasma-1988.img (${res.status})`)
  originalImage = new Uint8Array(await res.arrayBuffer())
  return originalImage
}

async function loadTomData(): Promise<TomsPlasmaData> {
  if (tomData) return tomData
  const res = await fetch(`${import.meta.env.BASE_URL}toms-plasma-1994.dat`)
  if (!res.ok) throw new Error(`could not load toms-plasma-1994.dat (${res.status})`)
  tomData = parseTomsPlasmaData(await res.arrayBuffer())
  return tomData
}

function paletteBytes(name: PaletteName): Uint8Array {
  return name === 'custom' ? buildPaletteFromHexStops(state.customColors) : buildPalette(name)
}

function drawPalettePreview(palette: Uint8Array): void {
  const preview = $<HTMLCanvasElement>('palette-preview')
  const ctx = preview.getContext('2d')
  if (!ctx) return
  const image = ctx.createImageData(preview.width, preview.height)
  for (let x = 0; x < preview.width; x++) {
    const index = 1 + Math.floor((x / preview.width) * 192)
    for (let y = 0; y < preview.height; y++) {
      const out = (y * preview.width + x) * 4
      image.data[out] = palette[index * 3]!
      image.data[out + 1] = palette[index * 3 + 1]!
      image.data[out + 2] = palette[index * 3 + 2]!
      image.data[out + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
}

function setDisplayedPalette(palette: Uint8Array): void {
  renderer.setPalette(palette)
  drawPalettePreview(palette)
}

// ---------------------------------------------------------------- generation and mode switching
function regenerateMulvey(): void {
  const { w, h } = RENDER_PROFILES[state.renderProfile]
  const t0 = performance.now()
  const px = generateDiamondSquare({
    width: w,
    height: h,
    roughness: state.roughness,
    rand: mulberry32(state.seed),
    centreDisplacement: state.centreDisplacement,
  })
  genMs = performance.now() - t0
  renderer.setIndices(px, w, h)
  updateReadout()
}

function applyTomPalette(): void {
  if (state.tomPalette === 'tom') {
    const engine = state.renderProfile === 'authentic' ? tomEngine : tomModernEngine
    if (engine) setDisplayedPalette(engine.paletteForFrame(tomFrame))
  } else {
    setDisplayedPalette(paletteBytes(state.tomPalette))
  }
}

function renderTomFrame(): void {
  if (state.renderProfile === 'authentic') {
    if (!tomEngine) return
    renderer.updateIndices(tomEngine.render(tomFrame, state.tomSwim))
  } else {
    if (!tomModernEngine) return
    tomMovement = tomModernEngine.movementForFrame(tomFrame)
  }
  applyTomPalette()
}

async function regenerateTom(): Promise<void> {
  const data = await loadTomData()
  const t0 = performance.now()
  if (state.renderProfile === 'authentic') {
    tomModernEngine = null
    tomEngine = new TomsPlasmaEngine(data, state.tomSeed, state.tomRoughness)
  } else {
    const { w, h } = RENDER_PROFILES[state.renderProfile]
    tomEngine = null
    tomModernEngine = new TomsPlasmaModernEngine(data, state.tomSeed, state.tomRoughness, w, h)
  }
  tomGenMs = performance.now() - t0
  tomFrame = 0
  tomFrameFraction = 0
  if (tomEngine) {
    renderer.setIndices(tomEngine.render(tomFrame, state.tomSwim), TOM_WIDTH, TOM_HEIGHT)
  } else if (tomModernEngine) {
    renderer.setIndices(tomModernEngine.field, tomModernEngine.width, tomModernEngine.height)
    tomMovement = tomModernEngine.movementForFrame(tomFrame)
  }
  applyTomPalette()
  updateReadout()
}

function applyStandardPalette(): void {
  setDisplayedPalette(paletteBytes(state.palette))
}

function applyRenderPresentation(): void {
  const profile = RENDER_PROFILES[state.renderProfile]
  renderer.setSampling(state.sampling === 'pixel' ? 'pixel' : 'smooth')
  const frame = $<HTMLDivElement>('frame')
  const maxHeight = Math.min(Math.max(200, innerHeight - 150), 660)
  frame.style.aspectRatio = String(profile.aspect)
  frame.style.removeProperty('width')
  frame.style.setProperty('--frame-max-width', `${Math.floor(maxHeight * profile.aspect)}px`)
  $<HTMLElement>('stage').style.setProperty('--display-aspect', String(profile.aspect))
}

async function applyType(): Promise<void> {
  paletteOffset = 0
  applyRenderPresentation()
  if (state.type === 'mulvey') {
    applyStandardPalette()
    if (state.mulveySource === 'original') {
      renderer.setIndices(await loadOriginal(), 320, 200)
      genMs = 0
    } else {
      regenerateMulvey()
    }
  } else if (state.type === 'tom') {
    await regenerateTom()
  } else {
    applyStandardPalette()
  }
  syncControls()
  updateReadout()
}

async function switchType(type: PlasmaType): Promise<void> {
  if (type !== state.type) {
    modeRendering[state.type] = {
      renderProfile: state.renderProfile,
      sampling: state.sampling,
    }
    if (state.type !== 'tom') modePalettes[state.type] = state.palette
    state.type = type
    Object.assign(state, modeRendering[type])
    if (type !== 'tom') state.palette = modePalettes[type]
  }
  await applyType()
}

// ---------------------------------------------------------------- render loop
function previewScale(): number {
  if (forceFullResolution || state.previewQuality === 'full') return 1
  return state.previewQuality === 'balanced' ? 0.5 : 0.25
}

function sampleAudio(): void {
  if (!audioAnalyser || !audioData) {
    audioEnergy = [0, 0]
    return
  }
  audioAnalyser.getByteFrequencyData(audioData)
  const average = (from: number, to: number): number => {
    let sum = 0
    for (let i = from; i < to; i++) sum += audioData![i] ?? 0
    return sum / Math.max(1, to - from) / 255
  }
  const bassEnd = Math.max(2, Math.floor(audioData.length * 0.08))
  const midEnd = Math.max(bassEnd + 1, Math.floor(audioData.length * 0.35))
  const bass = average(1, bassEnd)
  const mids = average(bassEnd, midEnd)
  audioPeak = [Math.max(audioPeak[0], bass), Math.max(audioPeak[1], mids)]
  audioEnergy = [audioEnergy[0] * 0.78 + bass * 0.22, audioEnergy[1] * 0.82 + mids * 0.18]
}

function drawCurrentScene(): void {
  const mode: RenderMode = state.type === 'demoscene'
    ? 'sines'
    : state.type === 'tom'
      ? state.renderProfile === 'authentic'
        ? state.tomPalette === 'tom' ? 'direct' : 'indexed'
        : state.tomPalette === 'tom' ? 'tom-direct' : 'tom-indexed'
      : 'indexed'
  const profile = RENDER_PROFILES[state.renderProfile]
  const scale = previewScale()
  const looping = state.type === 'demoscene' && state.loopSeconds > 0
  const phase = looping ? ((animationTime % state.loopSeconds) / state.loopSeconds) * Math.PI * 2 : animationTime
  const paletteCycles = state.speed === 0 ? 0 : Math.max(1, Math.round((state.speed * state.loopSeconds) / 192))
  const offset = looping ? (phase / (Math.PI * 2)) * 192 * paletteCycles : paletteOffset

  renderer.draw({
    mode,
    offset,
    time: phase,
    scale: state.sineScale,
    outputWidth: Math.max(1, Math.round(profile.w * scale)),
    outputHeight: Math.max(1, Math.round(profile.h * scale)),
    smooth: state.sampling !== 'pixel',
    glow: state.sampling === 'glow' ? 1 : 0,
    demoPattern: DEMO_PATTERN_INDEX[state.demoPattern],
    demoFinish: DEMO_FINISH_INDEX[state.demoFinish],
    demoMotion: state.demoMotion,
    demoIntensity: state.demoIntensity,
    demoAudio: audioEnergy,
    looping,
    loopCycles: Math.max(1, Math.round(state.demoMotion * 2)),
    tomFirst: tomMovement.first,
    tomSecond: tomMovement.second,
    tomSwim: state.tomSwim,
  })
}

/** Any interaction or layout change can alter the scene; redraw on the next frame. */
export function markSceneDirty(): void { needsRedraw = true }

for (const evt of ['input', 'change', 'click', 'keydown', 'pointerdown'] as const) {
  document.addEventListener(evt, markSceneDirty, { capture: true, passive: true })
}
window.addEventListener('resize', markSceneDirty)
document.addEventListener('visibilitychange', markSceneDirty)

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  if (!state.paused) {
    needsRedraw = true
    animationTime += dt
    if (!(state.type === 'demoscene' && state.loopSeconds > 0)) paletteOffset += state.speed * dt
    if (state.type === 'tom' && (tomEngine || tomModernEngine)) {
      tomFrameFraction += state.speed * dt
      const steps = Math.floor(tomFrameFraction)
      if (steps > 0) {
        tomFrameFraction -= steps
        tomFrame = (tomFrame + steps) % TOM_FRAME_COUNT
        renderTomFrame()
        updateReadout()
      }
    }
  }
  sampleAudio()
  // Live audio keeps the field moving even while paused.
  if (needsRedraw || audioAnalyser) {
    drawCurrentScene()
    needsRedraw = false
  }
  fpsFrames++
  if (now - fpsSince >= 500) {
    fpsValue = (fpsFrames * 1000) / (now - fpsSince)
    fpsFrames = 0
    fpsSince = now
    updateDiagnostics()
  }
  requestAnimationFrame(frame)
}

// ---------------------------------------------------------------- UI
function syncPaletteSelect(): void {
  const select = $<HTMLSelectElement>('palette')
  const wantedMode = state.type === 'tom' ? 'tom' : 'standard'
  if (select.dataset['mode'] !== wantedMode) {
    select.replaceChildren()
    if (state.type === 'tom') {
      const original = document.createElement('option')
      original.value = 'tom'
      original.textContent = "Tom's animated 1994 palette"
      select.appendChild(original)
    }
    for (const [key, label] of Object.entries(PALETTE_LABELS)) {
      const option = document.createElement('option')
      option.value = key
      option.textContent = label
      select.appendChild(option)
    }
    select.dataset['mode'] = wantedMode
  }
  select.value = state.type === 'tom' ? state.tomPalette : state.palette
}

const isDemosceneScene = (value: string): value is DemosceneScene =>
  value in DEMO_SCENES

function matchingDemosceneScene(): DemosceneScene | null {
  for (const [name, scene] of Object.entries(DEMO_SCENES) as [DemosceneScene, DemosceneSceneSettings][]) {
    if (
      state.demoPattern === scene.pattern &&
      state.demoFinish === scene.finish &&
      state.palette === scene.palette &&
      state.sineScale === scene.frequency &&
      Math.abs(state.demoMotion - scene.motion) < 0.001 &&
      Math.abs(state.demoIntensity - scene.intensity) < 0.001 &&
      state.speed === scene.speed
    ) return name
  }
  return null
}

function syncDemosceneSceneSelect(): void {
  $<HTMLSelectElement>('demo-scene').value = matchingDemosceneScene() ?? 'custom'
}

function setRangeControl(id: string, value: number): void {
  const input = $<HTMLInputElement>(id)
  input.value = String(value)
  const output = document.getElementById(`${id}-val`)
  if (output) output.textContent = input.step.includes('.') ? value.toFixed(1) : String(value)
}

function syncStateInputs(): void {
  $<HTMLSelectElement>('mulvey-source').value = state.mulveySource
  $<HTMLInputElement>('seed').value = formatSeed(state.seed)
  $<HTMLInputElement>('centre').checked = state.centreDisplacement
  $<HTMLSelectElement>('tom-roughness').value = String(state.tomRoughness)
  $<HTMLInputElement>('tom-seed').value = formatTomSeed(state.tomSeed)
  $<HTMLInputElement>('tom-swim').checked = state.tomSwim
  $<HTMLSelectElement>('render-profile').value = state.renderProfile
  $<HTMLSelectElement>('sampling').value = state.sampling
  $<HTMLSelectElement>('preview-quality').value = state.previewQuality
  $<HTMLSelectElement>('demo-pattern').value = state.demoPattern
  $<HTMLSelectElement>('demo-finish').value = state.demoFinish
  $<HTMLSelectElement>('loop-seconds').value = String(state.loopSeconds)
  $<HTMLSelectElement>('record-seconds').value = '5'
  $<HTMLInputElement>('show-diagnostics').checked = false
  setRangeControl('roughness', state.roughness)
  setRangeControl('speed', state.speed)
  setRangeControl('sineScale', state.sineScale)
  setRangeControl('demo-motion', state.demoMotion)
  setRangeControl('demo-intensity', state.demoIntensity)
}

async function resetDefaults(): Promise<void> {
  const type = state.type
  await stopAudio()
  Object.assign(state, createDefaultState(type))
  modeRendering[type] = { renderProfile: state.renderProfile, sampling: state.sampling }
  if (type !== 'tom') modePalettes[type] = state.palette
  animationTime = 0
  paletteOffset = 0
  tomFrame = 0
  tomFrameFraction = 0
  syncStateInputs()
  await applyType()
  const label = type === 'mulvey' ? 'Mulvey 1988' : type === 'tom' ? "Tom's 1994" : 'Plasma Lab'
  setActionStatus(`${label} reset to defaults.`)
}

function applyDemosceneScene(name: DemosceneScene): void {
  const scene = DEMO_SCENES[name]
  state.demoPattern = scene.pattern
  state.demoFinish = scene.finish
  state.palette = scene.palette
  state.sineScale = scene.frequency
  state.demoMotion = scene.motion
  state.demoIntensity = scene.intensity
  state.speed = scene.speed
  state.surpriseSeed = null
  setRangeControl('sineScale', state.sineScale)
  setRangeControl('demo-motion', state.demoMotion)
  setRangeControl('demo-intensity', state.demoIntensity)
  setRangeControl('speed', state.speed)
  applyStandardPalette()
  syncControls()
  updateReadout()
}

function levelMeter(value: number): string {
  const filled = Math.min(10, Math.round(value * 10))
  return '\u2588'.repeat(filled) + '\u00b7'.repeat(10 - filled)
}

function updateDiagnostics(): void {
  const panel = $<HTMLElement>('diagnostics')
  const shown = $<HTMLInputElement>('show-diagnostics').checked
  panel.hidden = !shown
  if (!shown) return
  const profile = RENDER_PROFILES[state.renderProfile]
  const scale = previewScale()
  const parts = [
    `${fpsValue.toFixed(1)} FPS`,
    `${Math.round(profile.w * scale)}×${Math.round(profile.h * scale)} preview`,
  ]
  if (audioAnalyser) {
    // Two numbers, because they fail differently: the peak says whether the
    // microphone heard anything at all, and the shader pair says how much
    // survived smoothing. Peak near zero is an input problem; a large gap
    // between the two is the filters absorbing the transient.
    const pct = (v: number): string => `${Math.round(v * 100)}%`
    parts.push(
      `mic ${levelMeter(audioPeak[0])} peak bass ${pct(audioPeak[0])} mid ${pct(audioPeak[1])}`,
      `shader ${pct(audioEnergy[0])} / ${pct(audioEnergy[1])}`,
    )
    if (state.type !== 'demoscene') parts.push('ignored outside Plasma Lab')
    audioPeak = [0, 0]
  }
  panel.textContent = parts.join('  ·  ')
}

function setActionStatus(message: string): void {
  $('action-status').textContent = message
}

function syncCustomPaletteEditor(): void {
  $('custom-palette').hidden = (state.type === 'tom' ? state.tomPalette : state.palette) !== 'custom'
  document.querySelectorAll<HTMLInputElement>('#custom-colors input[type=color]').forEach((input, index) => {
    input.value = state.customColors[index] ?? DEFAULT_CUSTOM_COLORS[index]!
  })
}

function syncControls(): void {
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((button) => {
    button.classList.toggle('active', button.dataset['type'] === state.type)
  })
  $<HTMLSelectElement>('plasma-type').value = state.type
  $('grp-mulvey').hidden = state.type !== 'mulvey'
  $('grp-tom').hidden = state.type !== 'tom'
  $('grp-sines').hidden = state.type !== 'demoscene'
  $('mulvey-generate').hidden = state.mulveySource !== 'generated'
  $('note-original').hidden = state.mulveySource !== 'original'
  $('speed-label').textContent = state.type === 'tom' ? 'Animation speed' : 'Cycle speed'
  $('frequency-label').textContent = state.demoPattern === 'mandelbrot' ||
    state.demoPattern === 'memoryMandelbrot' || state.demoPattern === 'memoryTunnel'
    ? 'Zoom / detail'
    : 'Frequency'
  $('tom-swim-label').textContent = state.renderProfile === 'authentic'
    ? 'Show 160 × 100 swim window'
    : 'Show half-frame GPU swim window'
  $<HTMLButtonElement>('pause').textContent = state.paused ? 'Resume' : 'Pause'
  $<HTMLSelectElement>('render-profile').value = state.renderProfile
  $<HTMLSelectElement>('sampling').value = state.sampling
  $<HTMLSelectElement>('demo-pattern').value = state.demoPattern
  $<HTMLSelectElement>('demo-finish').value = state.demoFinish
  $<HTMLSelectElement>('preview-quality').value = state.previewQuality
  $<HTMLSelectElement>('loop-seconds').value = String(state.loopSeconds)
  syncPaletteSelect()
  syncCustomPaletteEditor()
  syncDemosceneSceneSelect()
  updateDiagnostics()
  writeState(state)
}

function updateReadout(): void {
  const parts: string[] = []
  const profile = RENDER_PROFILES[state.renderProfile]
  parts.push(`${profile.w}x${profile.h}`, profile.label)
  if (previewScale() < 1) parts.push(`${state.previewQuality} live preview`)
  if (state.type === 'mulvey' && state.mulveySource === 'generated') {
    parts.push(`seed ${formatSeed(state.seed)}`, `generated in ${genMs.toFixed(1)} ms`)
  } else if (state.type === 'mulvey') {
    parts.push(
      state.renderProfile === 'authentic' ? 'PLASMA.IMG' : '320x200 source upscale',
      'generated 5 Aug 1988',
    )
  } else if (state.type === 'tom') {
    parts.push(
      state.tomSwim
        ? state.renderProfile === 'authentic' ? '160x100 exact swimming window' : 'half-frame GPU swimming window'
        : 'palette cycle only',
      `frame ${tomFrame + 1}/${TOM_FRAME_COUNT}`,
      `random ${formatTomSeed(state.tomSeed)}`,
      `generated in ${tomGenMs.toFixed(1)} ms`,
    )
  } else {
    const scene = matchingDemosceneScene()
    if (scene) parts.push(DEMO_SCENES[scene].label)
    parts.push(
      DEMO_PATTERN_LABELS[state.demoPattern],
      DEMO_FINISH_LABELS[state.demoFinish],
      'computed per output pixel, per frame',
    )
    if (state.demoPattern === 'mandelbrot' || state.demoPattern === 'memoryMandelbrot') {
      parts.push('72 GPU iterations')
    } else if (state.demoPattern === 'memoryTunnel') {
      parts.push('96 GPU iterations', 'continuous zoom')
    }
    if (state.loopSeconds > 0) parts.push(`seamless ${state.loopSeconds}s loop`)
    if (audioAnalyser) parts.push('audio reactive')
  }
  $('readout').textContent = parts.join('  ·  ')
}

/** Restore URL state into a range before its first event can overwrite it. */
function bindRange(id: string, initial: number, apply: (value: number) => void, clearSurprise = false): void {
  const el = $<HTMLInputElement>(id)
  const out = document.getElementById(`${id}-val`)
  el.value = String(initial)
  const update = () => {
    const value = Number(el.value)
    apply(value)
    if (ready && clearSurprise) state.surpriseSeed = null
    if (out) out.textContent = el.step.includes('.') ? value.toFixed(1) : String(value)
    writeState(state)
  }
  el.addEventListener('input', update)
  update()
}

state.customColors.forEach((color, index) => {
  const input = document.createElement('input')
  input.type = 'color'
  input.value = color
  input.setAttribute('aria-label', `Custom palette color ${index + 1}`)
  input.addEventListener('input', () => {
    state.customColors[index] = input.value
    state.surpriseSeed = null
    if ((state.type === 'tom' ? state.tomPalette : state.palette) === 'custom') {
      if (state.type === 'tom') applyTomPalette()
      else applyStandardPalette()
    }
    writeState(state)
  })
  $('custom-colors').appendChild(input)
})

document.querySelectorAll<HTMLButtonElement>('.tab').forEach((button) => {
  button.addEventListener('click', () => {
    const type = button.dataset['type']
    void switchType(type === 'tom' || type === 'demoscene' ? type : 'mulvey')
  })
})

$<HTMLSelectElement>('plasma-type').addEventListener('change', (event) => {
  const type = (event.target as HTMLSelectElement).value
  void switchType(type === 'tom' || type === 'demoscene' ? type : 'mulvey')
})

document.querySelectorAll<HTMLButtonElement>('.reset-defaults').forEach((button) => {
  button.addEventListener('click', () => { void resetDefaults() })
})

$<HTMLSelectElement>('mulvey-source').addEventListener('change', (event) => {
  state.mulveySource = (event.target as HTMLSelectElement).value === 'original' ? 'original' : 'generated'
  void applyType()
})

$('regenerate').addEventListener('click', () => {
  state.mulveySource = 'generated'
  state.seed = randomSeed()
  $<HTMLInputElement>('seed').value = formatSeed(state.seed)
  $<HTMLSelectElement>('mulvey-source').value = state.mulveySource
  regenerateMulvey()
  syncControls()
})

$<HTMLInputElement>('seed').addEventListener('change', (event) => {
  const value = parseSeed((event.target as HTMLInputElement).value)
  if (value === null) {
    $<HTMLInputElement>('seed').value = formatSeed(state.seed)
    return
  }
  state.seed = value
  regenerateMulvey()
  writeState(state)
})

$<HTMLSelectElement>('render-profile').addEventListener('change', (event) => {
  const value = (event.target as HTMLSelectElement).value
  state.renderProfile = isRenderProfile(value) ? value : 'authentic'
  if (state.renderProfile !== 'authentic' && state.sampling === 'pixel') state.sampling = 'smooth'
  void applyType()
})

$<HTMLSelectElement>('sampling').addEventListener('change', (event) => {
  const value = (event.target as HTMLSelectElement).value
  state.sampling = isSamplingMode(value) ? value : 'pixel'
  applyRenderPresentation()
  syncControls()
})

$<HTMLSelectElement>('demo-scene').addEventListener('change', (event) => {
  const value = (event.target as HTMLSelectElement).value
  if (isDemosceneScene(value)) applyDemosceneScene(value)
})

$<HTMLSelectElement>('demo-pattern').addEventListener('change', (event) => {
  const value = (event.target as HTMLSelectElement).value
  state.demoPattern = isDemoscenePattern(value) ? value : 'fractalSwim'
  state.surpriseSeed = null
  $('frequency-label').textContent = state.demoPattern === 'mandelbrot' ||
    state.demoPattern === 'memoryMandelbrot' || state.demoPattern === 'memoryTunnel'
    ? 'Zoom / detail'
    : 'Frequency'
  syncDemosceneSceneSelect()
  updateReadout()
  writeState(state)
})

$<HTMLSelectElement>('demo-finish').addEventListener('change', (event) => {
  const value = (event.target as HTMLSelectElement).value
  state.demoFinish = isDemosceneFinish(value) ? value : 'clean'
  state.surpriseSeed = null
  syncDemosceneSceneSelect()
  updateReadout()
  writeState(state)
})

$<HTMLInputElement>('centre').addEventListener('change', (event) => {
  state.centreDisplacement = (event.target as HTMLInputElement).checked
  regenerateMulvey()
  writeState(state)
})

$<HTMLSelectElement>('tom-roughness').addEventListener('change', (event) => {
  state.tomRoughness = tomRoughnessParam((event.target as HTMLSelectElement).value)
  void regenerateTom().then(() => writeState(state))
})

$<HTMLInputElement>('tom-seed').addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement
  const value = parseTomSeed(input.value)
  if (value === null) {
    input.value = formatTomSeed(state.tomSeed)
    return
  }
  state.tomSeed = value
  input.value = formatTomSeed(value)
  void regenerateTom().then(() => writeState(state))
})

$<HTMLInputElement>('tom-swim').addEventListener('change', (event) => {
  state.tomSwim = (event.target as HTMLInputElement).checked
  renderTomFrame()
  updateReadout()
  writeState(state)
})

$('tom-regenerate').addEventListener('click', () => {
  state.tomSeed = randomSeed() & 0xffff
  $<HTMLInputElement>('tom-seed').value = formatTomSeed(state.tomSeed)
  void regenerateTom().then(() => writeState(state))
})

$<HTMLSelectElement>('palette').addEventListener('change', (event) => {
  const value = (event.target as HTMLSelectElement).value
  if (state.type === 'tom') {
    state.tomPalette = value === 'tom' || isPaletteName(value) ? value : 'tom'
    applyTomPalette()
  } else if (isPaletteName(value)) {
    state.palette = value
    if (state.type === 'demoscene') state.surpriseSeed = null
    applyStandardPalette()
  }
  syncCustomPaletteEditor()
  syncDemosceneSceneSelect()
  writeState(state)
})

$('surprise').addEventListener('click', () => {
  const seed = randomSeed()
  const rand = mulberry32(seed)
  const choose = <T>(values: readonly T[]): T => values[Math.floor(rand() * values.length)]!
  state.surpriseSeed = seed
  state.demoPattern = choose<DemoscenePattern>([
    'fractalSwim', 'classic', 'liquid', 'vortex', 'kaleidoscope', 'mandala', 'mandelbrot',
    'memoryMandelbrot', 'memoryTunnel',
  ])
  state.demoFinish = choose<DemosceneFinish>(['clean', 'bloom', 'trails'])
  state.palette = choose<PaletteName>([
    'mulvey', 'fire', 'ice', 'spectrum', 'vgaCandy', 'starryNight', 'sunflowers', 'irises',
    'cafeTerrace', 'tunnelBlueGold',
  ])
  state.sineScale = 4 + Math.floor(rand() * 25)
  state.demoMotion = Math.round((0.3 + rand() * 1.7) * 10) / 10
  state.demoIntensity = Math.round((0.7 + rand() * 0.6) * 10) / 10
  state.speed = 8 + Math.floor(rand() * 41)
  animationTime = 0
  paletteOffset = 0
  setRangeControl('sineScale', state.sineScale)
  setRangeControl('demo-motion', state.demoMotion)
  setRangeControl('demo-intensity', state.demoIntensity)
  setRangeControl('speed', state.speed)
  applyStandardPalette()
  syncControls()
  updateReadout()
  setActionStatus(`Surprise seed ${formatSeed(seed)} — saved in the share link.`)
})

async function stopAudio(): Promise<void> {
  audioStream?.getTracks().forEach((track) => track.stop())
  audioStream = null
  audioAnalyser = null
  audioData = null
  audioEnergy = [0, 0]
  audioPeak = [0, 0]
  if (audioContext) await audioContext.close()
  audioContext = null
  $<HTMLButtonElement>('audio').textContent = 'Use microphone'
  $('audio-status').textContent = 'Audio reaction is off. Microphone input never leaves this device.'
  updateReadout()
}

if (!AUDIO_REACTION_ENABLED) {
  $('audio').hidden = true
  $('audio-status').hidden = true
}

$('audio').addEventListener('click', async () => {
  if (!AUDIO_REACTION_ENABLED) return
  if (audioContext) {
    await stopAudio()
    return
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const context = new AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.78
    context.createMediaStreamSource(stream).connect(analyser)
    audioStream = stream
    audioContext = context
    audioAnalyser = analyser
    audioData = new Uint8Array(analyser.frequencyBinCount)
    $<HTMLButtonElement>('audio').textContent = 'Stop microphone'
    $('audio-status').textContent = 'Reacting to bass and midrange locally. No audio is recorded or uploaded.'
    updateReadout()
  } catch (err) {
    $('audio-status').textContent = `Microphone unavailable: ${err instanceof Error ? err.message : String(err)}`
  }
})

$<HTMLSelectElement>('preview-quality').addEventListener('change', (event) => {
  const value = (event.target as HTMLSelectElement).value
  state.previewQuality = isPreviewQuality(value) ? value : 'balanced'
  syncControls()
  updateReadout()
})

$<HTMLInputElement>('show-diagnostics').addEventListener('change', updateDiagnostics)

$<HTMLSelectElement>('loop-seconds').addEventListener('change', (event) => {
  state.loopSeconds = loopSecondsParam((event.target as HTMLSelectElement).value)
  animationTime = 0
  if (state.loopSeconds > 0) $<HTMLSelectElement>('record-seconds').value = String(state.loopSeconds)
  syncControls()
  updateReadout()
})

$('share').addEventListener('click', async () => {
  writeState(state)
  try {
    await navigator.clipboard.writeText(location.href)
    setActionStatus('Share link copied to the clipboard.')
  } catch {
    const input = document.createElement('textarea')
    input.value = location.href
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    input.remove()
    setActionStatus('Share link copied to the clipboard.')
  }
})

$('preset-export').addEventListener('click', () => {
  writeState(state)
  const preset = JSON.stringify({
    format: 'plasma-scene',
    version: 1,
    created: new Date().toISOString(),
    query: location.search.slice(1),
  }, null, 2)
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(new Blob([preset], { type: 'application/json' }))
  anchor.download = `plasma-generator-${typeSlug(state.type)}-preset.json`
  anchor.click()
  URL.revokeObjectURL(anchor.href)
  setActionStatus('Preset JSON saved.')
})

$('preset-import').addEventListener('click', () => $<HTMLInputElement>('preset-file').click())
$<HTMLInputElement>('preset-file').addEventListener('change', async (event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const preset: unknown = JSON.parse(await file.text())
    if (!preset || typeof preset !== 'object') throw new Error('not a preset object')
    const data = preset as Record<string, unknown>
    if (data['format'] !== 'plasma-scene' || data['version'] !== 1 || typeof data['query'] !== 'string') {
      throw new Error('unsupported preset format')
    }
    history.replaceState(null, '', `?${data['query']}`)
    location.reload()
  } catch (err) {
    setActionStatus(`Could not load preset: ${err instanceof Error ? err.message : String(err)}`)
    input.value = ''
  }
})

$('record').addEventListener('click', async () => {
  if (recording) return
  if (!('MediaRecorder' in window) || !canvas.captureStream) {
    setActionStatus('WebM recording is not supported by this browser.')
    return
  }
  const requested = Number($<HTMLSelectElement>('record-seconds').value)
  const seconds = state.type === 'demoscene' && state.loopSeconds > 0 ? state.loopSeconds : requested
  if (state.type === 'demoscene' && state.loopSeconds > 0) animationTime = 0
  forceFullResolution = true
  recording = true
  drawCurrentScene()
  const stream = canvas.captureStream(60)
  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find((type) => MediaRecorder.isTypeSupported(type))
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []
  recorder.addEventListener('dataavailable', (event) => { if (event.data.size) chunks.push(event.data) })
  const button = $<HTMLButtonElement>('record')
  button.disabled = true
  button.classList.add('recording')
  button.textContent = `Recording ${seconds}s…`
  setActionStatus('Recording at full render-profile resolution.')
  await new Promise<void>((resolve) => {
    recorder.addEventListener('stop', () => resolve(), { once: true })
    recorder.start(250)
    window.setTimeout(() => recorder.stop(), seconds * 1000)
  })
  stream.getTracks().forEach((track) => track.stop())
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(new Blob(chunks, { type: mimeType ?? 'video/webm' }))
  anchor.download = `plasma-generator-${typeSlug(state.type)}-${seconds}s.webm`
  anchor.click()
  URL.revokeObjectURL(anchor.href)
  forceFullResolution = false
  recording = false
  button.disabled = false
  button.classList.remove('recording')
  button.textContent = 'Record WebM'
  setActionStatus(`Saved ${seconds}-second WebM${state.type === 'demoscene' && state.loopSeconds > 0 ? ' with loop-aware timing' : ''}.`)
})

$('pause').addEventListener('click', () => {
  state.paused = !state.paused
  syncControls()
})

async function toggleFullscreen(): Promise<void> {
  if (document.fullscreenElement) await document.exitFullscreen()
  else await $('stage').requestFullscreen()
}

function syncFullscreenButton(): void {
  $<HTMLButtonElement>('fullscreen').textContent = document.fullscreenElement
    ? 'Exit full screen (F)'
    : 'Full screen (F)'
}

$('fullscreen').addEventListener('click', () => { void toggleFullscreen() })
document.addEventListener('fullscreenchange', syncFullscreenButton)
window.addEventListener('resize', applyRenderPresentation)

function togglePresentation(): void {
  const active = $('stage').classList.toggle('presentation')
  $<HTMLButtonElement>('presentation').textContent = active ? 'Exit presentation (H)' : 'Presentation (H)'
}

$('presentation').addEventListener('click', togglePresentation)

$('export').addEventListener('click', async () => {
  forceFullResolution = true
  drawCurrentScene()
  const blob = await renderer.toBlob()
  forceFullResolution = false
  drawCurrentScene()
  if (!blob) return
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(blob)
  const detail = state.type === 'mulvey'
    ? state.mulveySource
    : state.type === 'tom'
      ? formatTomSeed(state.tomSeed)
      : `${state.demoPattern}-${state.demoFinish}`
  anchor.download = `plasma-generator-${typeSlug(state.type)}-${detail}.png`
  anchor.click()
  URL.revokeObjectURL(anchor.href)
  setActionStatus(`PNG saved at ${RENDER_PROFILES[state.renderProfile].label} resolution.`)
})

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
  if (event.key === ' ') {
    event.preventDefault()
    state.paused = !state.paused
    syncControls()
  }
  if (event.key.toLowerCase() === 'n') {
    if (state.type === 'tom') $('tom-regenerate').click()
    if (state.type === 'mulvey') $('regenerate').click()
  }
  if (event.key.toLowerCase() === 'f') void toggleFullscreen()
  if (event.key.toLowerCase() === 'h') togglePresentation()
  if (event.key === 'Escape' && $('stage').classList.contains('presentation')) togglePresentation()
  if (event.key.toLowerCase() === 'w' && state.type === 'tom') {
    state.tomSwim = !state.tomSwim
    $<HTMLInputElement>('tom-swim').checked = state.tomSwim
    renderTomFrame()
    syncControls()
    updateReadout()
  }
  if (state.type === 'tom' && ['1', '2', '3'].includes(event.key)) {
    state.tomRoughness = event.key === '2' ? 127 : event.key === '3' ? 63 : 255
    $<HTMLSelectElement>('tom-roughness').value = String(state.tomRoughness)
    void regenerateTom().then(() => writeState(state))
  }
})

// Bound before applyType(), so URL-restored values drive the first generation.
let ready = false
bindRange('roughness', state.roughness, (value) => {
  state.roughness = value
  if (ready && state.type === 'mulvey' && state.mulveySource === 'generated') regenerateMulvey()
})
bindRange('speed', state.speed, (value) => {
  state.speed = value
  if (ready) {
    if (state.type === 'demoscene') state.surpriseSeed = null
    syncDemosceneSceneSelect()
  }
})
bindRange('sineScale', state.sineScale, (value) => {
  state.sineScale = value
  if (ready) syncDemosceneSceneSelect()
}, true)
bindRange('demo-motion', state.demoMotion, (value) => {
  state.demoMotion = value
  if (ready) syncDemosceneSceneSelect()
}, true)
bindRange('demo-intensity', state.demoIntensity, (value) => {
  state.demoIntensity = value
  if (ready) syncDemosceneSceneSelect()
}, true)
ready = true

syncStateInputs()
syncFullscreenButton()

canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault()
  state.paused = true
  $('fatal').textContent = 'The graphics context was lost. Waiting for the browser to restore it…'
  $('fatal').hidden = false
})

canvas.addEventListener('webglcontextrestored', () => {
  $('fatal').textContent = 'Graphics restored. Reloading the scene…'
  location.reload()
})

window.addEventListener('pagehide', () => { void stopAudio() })

if (state.paused && matchMedia('(prefers-reduced-motion: reduce)').matches) {
  setActionStatus('Animation started paused to respect your reduced-motion preference.')
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    })
  })
}

void applyType()
  .then(() => requestAnimationFrame(frame))
  .catch((err: unknown) => {
    $('fatal').textContent = err instanceof Error ? err.message : String(err)
    $('fatal').hidden = false
  })
