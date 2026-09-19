/**
 * The PLASMA.PAS colour wheel by Bret Mulvey (1988).
 *
 * Entry 0 is the grey "not yet computed" background. Entries 1..192 form a
 * three-segment wheel and are the only ones that rotate. 193..255 are unused.
 * Source values are VGA 6-bit (0..63); we scale to 8-bit for the GPU.
 */
export const CYCLE_START = 1
export const CYCLE_COUNT = 192

export type PaletteName =
  | 'mulvey' | 'fire' | 'ice' | 'spectrum' | 'grey'
  | 'vgaCandy' | 'starryNight' | 'sunflowers' | 'irises' | 'cafeTerrace'
  | 'tunnelBlueGold' | 'custom'

export const DEFAULT_CUSTOM_COLORS = [
  '#071949', '#1462a0', '#f2cc4e', '#fbeba0', '#c69e2b', '#0b2a65',
] as const

const to8 = (v6: number): number => Math.min(255, Math.round((v6 * 255) / 63))

/** Verbatim from PLASMA.PAS: three 64-step segments, green->red->blue->green. */
function mulveyWheel(): Uint8Array {
  const p = new Uint8Array(256 * 3)
  const set = (i: number, r: number, g: number, b: number) => {
    p[i * 3] = to8(r); p[i * 3 + 1] = to8(g); p[i * 3 + 2] = to8(b)
  }
  set(0, 32, 32, 32) // grey background
  for (let i = 0; i < 64; i++) {
    set(i + 1,   i,      63 - i, 0)
    set(i + 65,  63 - i, 0,      i)
    set(i + 129, 0,      i,      63 - i)
  }
  return p
}

/** Build a 192-entry wheel by interpolating through a list of RGB8 stops. */
function fromStops(stops: [number, number, number][]): Uint8Array {
  const p = new Uint8Array(256 * 3)
  p[0] = p[1] = p[2] = 128
  const segs = stops.length
  for (let i = 0; i < CYCLE_COUNT; i++) {
    const t = (i / CYCLE_COUNT) * segs
    const a = stops[Math.floor(t) % segs]!
    const b = stops[(Math.floor(t) + 1) % segs]!
    const f = t - Math.floor(t)
    const o = (CYCLE_START + i) * 3
    for (let c = 0; c < 3; c++) p[o + c] = Math.round(a[c]! + (b[c]! - a[c]!) * f)
  }
  return p
}

/**
 * Entries 193..255 are outside the rotating wheel and would otherwise stay
 * black. The shader pins indices to 1..192, so this is belt-and-braces: it
 * means a rounding slip can never show up as a black speckle.
 */
function padUnused(p: Uint8Array): Uint8Array {
  const last = (CYCLE_START + CYCLE_COUNT - 1) * 3
  for (let i = CYCLE_START + CYCLE_COUNT; i < 256; i++) {
    p[i * 3] = p[last]!; p[i * 3 + 1] = p[last + 1]!; p[i * 3 + 2] = p[last + 2]!
  }
  return p
}

export function buildPalette(name: PaletteName): Uint8Array {
  if (name === 'custom') return buildPaletteFromHexStops(DEFAULT_CUSTOM_COLORS)
  return padUnused(buildWheel(name))
}

/** Build a rotating wheel from user-editable CSS hex colors. */
export function buildPaletteFromHexStops(colors: readonly string[]): Uint8Array {
  const stops = colors.map((color): [number, number, number] => {
    const match = /^#([0-9a-f]{6})$/i.exec(color)
    if (!match) throw new Error(`Invalid palette color: ${color}`)
    const value = Number.parseInt(match[1]!, 16)
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
  })
  if (stops.length < 2) throw new Error('A custom palette needs at least two colors.')
  return padUnused(fromStops(stops))
}

function buildWheel(name: PaletteName): Uint8Array {
  switch (name) {
    case 'mulvey': return mulveyWheel()
    case 'fire':   return fromStops([[0,0,0],[140,0,0],[255,90,0],[255,220,120],[255,90,0],[140,0,0]])
    case 'ice':    return fromStops([[4,10,40],[20,90,180],[130,220,255],[245,255,255],[130,220,255],[20,90,180]])
    case 'spectrum': return fromStops([[255,0,0],[255,255,0],[0,255,0],[0,255,255],[0,0,255],[255,0,255]])
    case 'grey':   return fromStops([[0,0,0],[255,255,255]])
    // A newly curated VGA-era wheel for Fractal Swim: cool shadows, phosphor
    // green, pale pink, magenta, and violet echo the character of 1990s plasma.
    case 'vgaCandy': return fromStops([
      [24,26,30],[98,104,107],[226,214,226],[249,221,242],[213,82,146],
      [103,37,105],[64,44,150],[105,111,239],[53,205,30],[190,249,173],
      [242,232,242],[183,88,148],[24,26,30],
    ])
    // Artist-inspired wheels are curated color impressions, not sampled reproductions.
    // Repeated blue stops deliberately give Starry Night a mostly nocturnal cycle,
    // with narrow ochre and ivory bands that flare as highlights.
    case 'starryNight': return fromStops([
      [4,12,38],[7,25,73],[12,45,111],[20,72,145],[43,108,167],
      [82,145,174],[32,91,148],[11,42,101],[100,112,70],
      [198,158,43],[242,204,78],[251,235,160],[194,159,49],[37,83,135],
    ])
    case 'sunflowers': return fromStops([
      [35,24,15],[82,54,18],[122,91,24],[165,127,30],[211,164,38],
      [246,199,61],[255,225,112],[207,145,32],[143,86,21],[84,92,39],[42,55,27],
    ])
    case 'irises': return fromStops([
      [20,20,63],[40,43,112],[73,69,151],[112,101,184],[151,142,205],
      [82,92,174],[42,70,133],[30,105,91],[67,137,87],[176,174,75],[239,217,132],
    ])
    case 'cafeTerrace': return fromStops([
      [5,17,48],[8,35,91],[13,62,135],[27,93,162],[47,125,171],
      [19,65,120],[8,29,72],[132,84,25],[211,139,34],[248,188,67],
      [255,226,142],[224,160,48],[91,55,25],
    ])
    case 'tunnelBlueGold': return fromStops([
      [2,7,34],[7,29,86],[15,70,145],[55,135,199],[139,205,238],
      [222,244,250],[255,250,214],[219,174,89],[146,82,34],[63,20,25],
      [5,16,61],[28,91,167],[171,224,245],[244,243,211],[177,119,46],
    ])
    case 'custom': return fromStops(DEFAULT_CUSTOM_COLORS.map((color) => {
      const value = Number.parseInt(color.slice(1), 16)
      return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as [number, number, number]
    }))
  }
}

export const PALETTE_LABELS: Record<PaletteName, string> = {
  mulvey: 'Mulvey 1988', fire: 'Fire', ice: 'Ice', spectrum: 'Spectrum', grey: 'Greyscale',
  vgaCandy: 'VGA Candy',
  starryNight: 'Starry Night–inspired',
  sunflowers: 'Sunflowers–inspired',
  irises: 'Irises–inspired',
  cafeTerrace: 'Café Terrace–inspired',
  tunnelBlueGold: 'Tunnel Blue & Gold',
  custom: 'Custom palette',
}
