/**
 * Tom Dibble's Tom's Plasma 1.1 (1994).
 * Copyright 1994 Tom Dibble. Ported with credit under the permission notice in
 * TPLAS.DOC, which permits use and requires derived code to retain the same
 * freedom. Tom credited Jeremy Longley's JCL-Plasm and Thomas Hagen for the
 * earlier "swimming" technique.
 *
 * The original TOMSPLAS.DAT layout is:
 *   40,000 bytes  10,000 pairs of little-endian movement offsets
 *    3,072 bytes  four 256-entry VGA palettes (6-bit RGB)
 *   65,536 bytes  pre-generated random bytes
 *
 * TPLAS.ASM generates one 320x200 fractal, then "swims" it by adding two
 * moving 160x100 windows into the centre of the VGA framebuffer. The packed
 * 32-bit addition (including carries between adjacent pixels) is intentional:
 * the original manual calls out that speed-over-purity shortcut explicitly.
 */

export const TOM_WIDTH = 320
export const TOM_HEIGHT = 200
export const TOM_WINDOW_WIDTH = 160
export const TOM_WINDOW_HEIGHT = 100
export const TOM_FRAME_COUNT = 10_000
export const TOM_PALETTE_COLORS = 1_024
export const TOM_DATA_BYTES = 108_608

const MOVEMENT_BYTES = TOM_FRAME_COUNT * 4
const PALETTE_BYTES = TOM_PALETTE_COLORS * 3
const RANDOM_OFFSET = MOVEMENT_BYTES + PALETTE_BYTES

export type TomRoughness = 255 | 127 | 63

export interface TomsPlasmaData {
  leads: Uint16Array
  deltas: Int16Array
  palette6: Uint8Array
  random: Uint8Array
}

export interface TomMovement {
  first: readonly [number, number]
  second: readonly [number, number]
}

export function parseTomsPlasmaData(input: ArrayBuffer | Uint8Array): TomsPlasmaData {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  if (bytes.byteLength !== TOM_DATA_BYTES) {
    throw new Error(`invalid Tom's Plasma data: expected ${TOM_DATA_BYTES} bytes, got ${bytes.byteLength}`)
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const leads = new Uint16Array(TOM_FRAME_COUNT)
  const deltas = new Int16Array(TOM_FRAME_COUNT)
  for (let i = 0; i < TOM_FRAME_COUNT; i++) {
    leads[i] = view.getUint16(i * 4, true)
    deltas[i] = view.getInt16(i * 4 + 2, true)
  }

  return {
    leads,
    deltas,
    palette6: bytes.slice(MOVEMENT_BYTES, RANDOM_OFFSET),
    random: bytes.slice(RANDOM_OFFSET),
  }
}

/** Port of GenPlasma/SubDiv/Adj, including the index-0 sentinel and masks. */
export function generateTomsPlasma(
  data: TomsPlasmaData,
  randomStart: number,
  initialRoughness: TomRoughness,
): Uint8Array {
  const px = new Uint8Array(TOM_WIDTH * TOM_HEIGHT)
  let randomPointer = randomStart & 0xffff

  const random8 = (): number => {
    const value = data.random[randomPointer]!
    randomPointer = (randomPointer + 1) & 0xffff
    return value
  }
  const get = (x: number, y: number): number => px[y * TOM_WIDTH + x]!
  const put = (x: number, y: number, value: number): void => {
    px[y * TOM_WIDTH + x] = value
  }

  const adjust = (
    x1: number, y1: number, x2: number, y2: number,
    x: number, y: number, roughness: number,
  ): void => {
    if (get(x, y) !== 0) return
    const average = (get(x1, y1) + get(x2, y2)) >> 1
    const delta = (random8() & roughness) - (roughness >> 1)
    put(x, y, Math.max(1, Math.min(255, average + delta)))
  }

  const subdivide = (
    x1: number, y1: number, x2: number, y2: number, roughness: number,
  ): void => {
    const x = (x1 + x2) >> 1
    const y = (y1 + y2) >> 1
    if (x <= x1 && y <= y1) return

    adjust(x1, y1, x2, y1, x, y1, roughness)
    adjust(x2, y1, x2, y2, x2, y, roughness)
    adjust(x1, y2, x2, y2, x, y2, roughness)
    adjust(x1, y1, x1, y2, x1, y, roughness)

    put(x, y, (get(x, y1) + get(x2, y) + get(x, y2) + get(x1, y)) >> 2)

    const childRoughness = roughness >> 1
    subdivide(x1, y1, x, y, childRoughness)
    subdivide(x, y1, x2, y, childRoughness)
    subdivide(x, y, x2, y2, childRoughness)
    subdivide(x1, y, x, y2, childRoughness)
  }

  // GenPlasma's original corner order matters because it consumes DAT bytes.
  put(0, 0, random8())
  put(TOM_WIDTH - 1, TOM_HEIGHT - 1, random8())
  put(0, TOM_HEIGHT - 1, random8())
  put(TOM_WIDTH - 1, 0, random8())
  subdivide(0, 0, TOM_WIDTH - 1, TOM_HEIGHT - 1, initialRoughness)
  return px
}

/**
 * Resolution-independent version of Tom's subdivision field for modern output.
 * It keeps the DAT random stream and corner order, but lets the perturbation
 * decay with geometric scale instead of relying on the 320x200 bit masks.
 */
export function generateTomsPlasmaModern(
  data: TomsPlasmaData,
  randomStart: number,
  initialRoughness: TomRoughness,
  width: number,
  height: number,
): Uint8Array {
  if (width < 2 || height < 2) throw new Error('modern Tom output must be at least 2x2')
  const px = new Uint8Array(width * height)
  let randomPointer = randomStart & 0xffff
  const baseAmplitude = (initialRoughness + 1) / 2

  const random8 = (): number => {
    const value = data.random[randomPointer]!
    randomPointer = (randomPointer + 1) & 0xffff
    return value
  }
  const get = (x: number, y: number): number => px[y * width + x]!
  const put = (x: number, y: number, value: number): void => {
    px[y * width + x] = value
  }
  const adjust = (
    x1: number, y1: number, x2: number, y2: number,
    x: number, y: number, amplitude: number,
  ): void => {
    if (get(x, y) !== 0) return
    const average = (get(x1, y1) + get(x2, y2)) * 0.5
    const delta = ((random8() / 255) * 2 - 1) * amplitude
    put(x, y, Math.max(1, Math.min(255, Math.round(average + delta))))
  }
  const subdivide = (
    x1: number, y1: number, x2: number, y2: number, amplitude: number,
  ): void => {
    const x = (x1 + x2) >> 1
    const y = (y1 + y2) >> 1
    if (x <= x1 && y <= y1) return

    adjust(x1, y1, x2, y1, x, y1, amplitude)
    adjust(x2, y1, x2, y2, x2, y, amplitude)
    adjust(x1, y2, x2, y2, x, y2, amplitude)
    adjust(x1, y1, x1, y2, x1, y, amplitude)
    put(x, y, Math.max(1, Math.round(
      (get(x, y1) + get(x2, y) + get(x, y2) + get(x1, y)) / 4,
    )))

    const childAmplitude = Math.max(0.75, amplitude * 0.56)
    subdivide(x1, y1, x, y, childAmplitude)
    subdivide(x, y1, x2, y, childAmplitude)
    subdivide(x, y, x2, y2, childAmplitude)
    subdivide(x1, y, x, y2, childAmplitude)
  }

  put(0, 0, random8())
  put(width - 1, height - 1, random8())
  put(0, height - 1, random8())
  put(width - 1, 0, random8())
  subdivide(0, 0, width - 1, height - 1, baseAmplitude)
  return px
}

/** Decode one canonical movement pair as normalized source-window positions. */
export function tomMovementAt(data: TomsPlasmaData, frame: number): TomMovement {
  const movement = ((frame % TOM_FRAME_COUNT) + TOM_FRAME_COUNT) % TOM_FRAME_COUNT
  const firstOffset = data.leads[movement]!
  const secondOffset = firstOffset + data.deltas[movement]!
  const normalize = (offset: number): readonly [number, number] => {
    const x = ((offset % TOM_WIDTH) + TOM_WIDTH) % TOM_WIDTH
    const y = Math.floor(offset / TOM_WIDTH)
    return [
      Math.max(0, Math.min(1, x / (TOM_WIDTH - TOM_WINDOW_WIDTH))),
      Math.max(0, Math.min(1, y / (TOM_HEIGHT - TOM_WINDOW_HEIGHT))),
    ]
  }
  return { first: normalize(firstOffset), second: normalize(secondOffset) }
}

const toRgb8 = (v6: number): number => Math.round((v6 * 255) / 63)

export class TomsPlasmaEngine {
  private readonly plasma: Uint8Array
  private readonly plasmaView: DataView
  private readonly output: Uint8Array
  private readonly outputView: DataView
  private readonly palette = new Uint8Array(256 * 3)

  constructor(
    private readonly data: TomsPlasmaData,
    randomStart: number,
    roughness: TomRoughness,
  ) {
    this.plasma = generateTomsPlasma(data, randomStart, roughness)
    this.plasmaView = new DataView(this.plasma.buffer)
    this.output = this.plasma.slice()
    this.outputView = new DataView(this.output.buffer)
  }

  /** Render one of the 10,000 canonical movement positions. */
  render(frame: number, swim: boolean): Uint8Array {
    this.output.set(this.plasma)
    if (!swim) return this.output

    const movement = ((frame % TOM_FRAME_COUNT) + TOM_FRAME_COUNT) % TOM_FRAME_COUNT
    const lead = this.data.leads[movement]!
    const delta = this.data.deltas[movement]!

    for (let y = 0; y < TOM_WINDOW_HEIGHT; y++) {
      const sourceRow = lead + y * TOM_WIDTH
      const destRow = (50 + y) * TOM_WIDTH + 90
      for (let x = 0; x < TOM_WINDOW_WIDTH; x += 4) {
        const a = this.plasmaView.getUint32(sourceRow + x, true)
        // TPLAS.ASM uses [si+bx] after LODSD has advanced SI by four bytes.
        const b = this.plasmaView.getUint32(sourceRow + delta + x + 4, true)
        this.outputView.setUint32(destRow + x, (a + b) >>> 0, true)
      }
    }
    return this.output
  }

  /** Build the DAC palette after the original one-entry-per-frame rotation. */
  paletteForFrame(frame: number): Uint8Array {
    this.palette.fill(0)
    const phase = ((frame + 1) % TOM_PALETTE_COLORS + TOM_PALETTE_COLORS) % TOM_PALETTE_COLORS
    for (let index = 1; index < 256; index++) {
      const source = (phase + index - 1) % TOM_PALETTE_COLORS
      const src = source * 3
      const dst = index * 3
      this.palette[dst] = toRgb8(this.data.palette6[src]!)
      this.palette[dst + 1] = toRgb8(this.data.palette6[src + 1]!)
      this.palette[dst + 2] = toRgb8(this.data.palette6[src + 2]!)
    }
    return this.palette
  }
}

/** Modern field + GPU compositor metadata; exact VGA remains TomsPlasmaEngine. */
export class TomsPlasmaModernEngine {
  readonly field: Uint8Array
  private readonly palette = new Uint8Array(256 * 3)

  constructor(
    private readonly data: TomsPlasmaData,
    randomStart: number,
    roughness: TomRoughness,
    readonly width: number,
    readonly height: number,
  ) {
    this.field = generateTomsPlasmaModern(data, randomStart, roughness, width, height)
  }

  movementForFrame(frame: number): TomMovement {
    return tomMovementAt(this.data, frame)
  }

  paletteForFrame(frame: number): Uint8Array {
    this.palette.fill(0)
    const phase = ((frame + 1) % TOM_PALETTE_COLORS + TOM_PALETTE_COLORS) % TOM_PALETTE_COLORS
    for (let index = 1; index < 256; index++) {
      const source = (phase + index - 1) % TOM_PALETTE_COLORS
      const src = source * 3
      const dst = index * 3
      this.palette[dst] = toRgb8(this.data.palette6[src]!)
      this.palette[dst + 1] = toRgb8(this.data.palette6[src + 1]!)
      this.palette[dst + 2] = toRgb8(this.data.palette6[src + 2]!)
    }
    return this.palette
  }
}
