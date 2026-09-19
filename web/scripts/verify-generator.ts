import { generateDiamondSquare } from '../src/generators/diamondSquare'
import {
  generateTomsPlasma,
  generateTomsPlasmaModern,
  parseTomsPlasmaData,
  TOM_DATA_BYTES,
  TOM_FRAME_COUNT,
  TomsPlasmaEngine,
  tomMovementAt,
} from '../src/generators/tomsPlasma'
import { mulberry32 } from '../src/rng'
import { buildPalette, buildPaletteFromHexStops, type PaletteName } from '../src/palette'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message)
}

const hash = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex')

const stats = (b: Uint8Array, w: number) => {
  let sum = 0, n = 0
  for (let i = 0; i < b.length - 1; i++) if ((i + 1) % w) { sum += Math.abs(b[i]! - b[i + 1]!); n++ }
  let mn = 255, mx = 0
  for (const v of b) { if (v < mn) mn = v; if (v > mx) mx = v }
  return { min: mn, max: mx, distinct: new Set(b).size, delta: Number((sum / n).toFixed(4)) }
}

const orig = new Uint8Array(readFileSync('public/plasma-1988.img'))
console.log('1988 PLASMA.IMG   ', JSON.stringify(stats(orig, 320)))

for (const F of [2.0, 0.5, 6.0]) {
  const px = generateDiamondSquare({ width: 320, height: 200, roughness: F, rand: mulberry32(0xDEADBEEF) })
  console.log(`TS port F=${F.toFixed(1)}     `, JSON.stringify(stats(px, 320)))
}

// determinism: same seed must give identical output
const a = generateDiamondSquare({ width: 320, height: 200, roughness: 2, rand: mulberry32(42) })
const b = generateDiamondSquare({ width: 320, height: 200, roughness: 2, rand: mulberry32(42) })
console.log('deterministic     ', a.every((v, i) => v === b[i]!))
console.log('zero (unset) px   ', a.reduce((n, v) => n + (v === 0 ? 1 : 0), 0), '(must be 0)')

// large resolution must not blow the stack
const big = generateDiamondSquare({ width: 1280, height: 800, roughness: 2, rand: mulberry32(7) })
console.log('1280x800 ok       ', big.length === 1280 * 800, JSON.stringify(stats(big, 1280)))

// Tom's Plasma: validate the canonical archive data and deterministic port.
const tomBytes = new Uint8Array(readFileSync('public/toms-plasma-1994.dat'))
assert(tomBytes.length === TOM_DATA_BYTES, "Tom's DAT has the wrong length")
assert(hash(tomBytes) === '8628b181cec3b5c365a11bb86b23ad953d65175e31692505899f14a36b4d596d',
  "Tom's DAT is not the untouched 1994 archive artifact")

const tomData = parseTomsPlasmaData(tomBytes)
const tomA = generateTomsPlasma(tomData, 0x1234, 255)
const tomB = generateTomsPlasma(tomData, 0x1234, 255)
assert(tomA.every((value, index) => value === tomB[index]), "Tom's generator is not deterministic")
assert(hash(tomA) === 'db4adbf4507ff3b4e6d3815172d329db6e51a750029c4486fb47bfa7be94634f',
  "Tom's exact generator output changed")

const tomEngine = new TomsPlasmaEngine(tomData, 0x1234, 255)
const noSwim = tomEngine.render(0, false).slice()
const swim0 = tomEngine.render(0, true).slice()
const swimLast = tomEngine.render(TOM_FRAME_COUNT - 1, true).slice()
let changedInside = 0
let changedOutside = 0
for (let y = 0; y < 200; y++) {
  for (let x = 0; x < 320; x++) {
    if (noSwim[y * 320 + x] === swim0[y * 320 + x]) continue
    if (x >= 90 && x < 250 && y >= 50 && y < 150) changedInside++
    else changedOutside++
  }
}
assert(changedInside > 10_000, "Tom's swim window did not materially change")
assert(changedOutside === 0, "Tom's compositor changed pixels outside its 160x100 window")
assert(!swim0.every((value, index) => value === swimLast[index]), "Tom's movement table did not move")
assert(hash(swim0) === '53fb7e682f4535aafe650eb3958e65ddc3f9608a75381cdec874c13f303fef8f',
  "Tom's exact first swim frame changed")
assert(hash(swimLast) === '6177ed6facb7cb36b0e631c32a0a7722476b4652a89993c1a0fb1380d50876be',
  "Tom's exact final swim frame changed")

const tomPalette = tomEngine.paletteForFrame(0)
assert(tomPalette.length === 256 * 3, "Tom's DAC palette has the wrong length")
assert(tomPalette[0] === 0 && tomPalette[1] === 0 && tomPalette[2] === 0,
  "Tom's background palette entry must remain black")

const modernA = generateTomsPlasmaModern(tomData, 0x1234, 255, 640, 360)
const modernB = generateTomsPlasmaModern(tomData, 0x1234, 255, 640, 360)
assert(modernA.length === 640 * 360, "Tom's modern generator returned the wrong dimensions")
assert(modernA.every((value, index) => value === modernB[index]),
  "Tom's modern generator is not deterministic")
assert(!modernA.includes(0), "Tom's modern generator left unset pixels")
const modernMovement = tomMovementAt(tomData, TOM_FRAME_COUNT - 1)
for (const value of [...modernMovement.first, ...modernMovement.second]) {
  assert(value >= 0 && value <= 1, "Tom's normalized movement escaped its source bounds")
}

console.log("Tom's DAT          ", tomBytes.length, hash(tomBytes))
console.log("Tom's field        ", JSON.stringify(stats(tomA, 320)), hash(tomA))
console.log("Tom's swim frame 0 ", `${changedInside} pixels changed inside`, hash(swim0))
console.log("Tom's final frame  ", hash(swimLast))
console.log("Tom's modern 640x360", JSON.stringify(stats(modernA, 640)), hash(modernA))

const artistPalettes: PaletteName[] = ['starryNight', 'sunflowers', 'irises', 'cafeTerrace']
const artistHashes = new Set<string>()
for (const name of artistPalettes) {
  const palette = buildPalette(name)
  assert(palette.length === 256 * 3, `${name} palette has the wrong length`)
  assert(new Set(Array.from({ length: 192 }, (_, i) =>
    `${palette[(i + 1) * 3]},${palette[(i + 1) * 3 + 1]},${palette[(i + 1) * 3 + 2]}`)).size > 100,
  `${name} palette does not contain a smooth color range`)
  artistHashes.add(hash(palette))
  console.log(`Artist palette ${name.padEnd(11)}`, hash(palette))
}
assert(artistHashes.size === artistPalettes.length, 'artist-inspired palettes must be visually distinct')

const tunnelPalette = buildPalette('tunnelBlueGold')
assert(tunnelPalette.length === 256 * 3, 'Tunnel Blue & Gold palette has the wrong length')
assert(new Set(Array.from({ length: 192 }, (_, i) =>
  `${tunnelPalette[(i + 1) * 3]},${tunnelPalette[(i + 1) * 3 + 1]},${tunnelPalette[(i + 1) * 3 + 2]}`)).size > 100,
'Tunnel Blue & Gold palette does not contain a smooth color range')

const customPalette = buildPaletteFromHexStops([
  '#071949', '#1462a0', '#f2cc4e', '#fbeba0', '#c69e2b', '#0b2a65',
])
assert(customPalette.length === 256 * 3, 'custom palette has the wrong length')
assert(new Set(customPalette).size > 100, 'custom palette does not contain a smooth color range')
