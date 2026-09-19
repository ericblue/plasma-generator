/**
 * Diamond-square plasma, ported from PLASMA.PAS (Bret Mulvey, 1988).
 *
 * Faithful to the original by default, including two quirks worth knowing:
 *
 *  1. Palette index 0 doubles as a "not yet computed" sentinel, which is how
 *     the recursion avoids recomputing edges shared between quadrants. That is
 *     why output is clamped to 1..192 and why an interrupted run shows grey
 *     holes.
 *  2. The centre point of each subdivision receives NO random displacement --
 *     it is a plain average of the four corners. Textbook diamond-square
 *     displaces it. Enable `centreDisplacement` to get the textbook behaviour.
 */
export interface PlasmaOptions {
  width: number
  height: number
  /** "Roughness". F = 2.0 in the original. */
  roughness: number
  rand: () => number
  /** false = faithful to 1988; true = textbook diamond-square. */
  centreDisplacement?: boolean
}

const MIN_VALUE = 1
const MAX_VALUE = 192

export function generateDiamondSquare(opts: PlasmaOptions): Uint8Array {
  const { width: w, height: h, roughness: F, rand } = opts
  const displaceCentre = opts.centreDisplacement ?? false
  const px = new Uint8Array(w * h) // 0 everywhere == "unset", exactly as in the original

  const get = (x: number, y: number): number => px[y * w + x]!
  const put = (x: number, y: number, v: number): void => { px[y * w + x] = v }

  const clamp = (v: number): number =>
    v < MIN_VALUE ? MIN_VALUE : v >= MAX_VALUE + 1 ? MAX_VALUE : Math.trunc(v)

  /** procedure adjust(xa,ya,x,y,xb,yb) */
  const adjust = (xa: number, ya: number, x: number, y: number, xb: number, yb: number): void => {
    if (get(x, y) !== 0) return // already computed by a neighbouring quadrant
    const d = Math.abs(xa - xb) + Math.abs(ya - yb)
    const v = (get(xa, ya) + get(xb, yb)) / 2 + (rand() - 0.5) * d * F
    put(x, y, clamp(v))
  }

  /** procedure subDivide(x1,y1,x2,y2) -- iterative, so large images cannot blow the stack. */
  const subDivide = (x1r: number, y1r: number, x2r: number, y2r: number): void => {
    const stack: number[] = [x1r, y1r, x2r, y2r]
    while (stack.length) {
      const y2 = stack.pop()!, x2 = stack.pop()!, y1 = stack.pop()!, x1 = stack.pop()!
      if (x2 - x1 < 2 && y2 - y1 < 2) continue

      const x = (x1 + x2) >> 1
      const y = (y1 + y2) >> 1

      adjust(x1, y1, x, y1, x2, y1) // top
      adjust(x2, y1, x2, y, x2, y2) // right
      adjust(x1, y2, x, y2, x2, y2) // bottom
      adjust(x1, y1, x1, y, x1, y2) // left

      if (get(x, y) === 0) {
        const mean = (get(x1, y1) + get(x2, y1) + get(x2, y2) + get(x1, y2)) / 4
        const d = Math.abs(x1 - x2) + Math.abs(y1 - y2)
        put(x, y, clamp(displaceCentre ? mean + (rand() - 0.5) * d * F : mean))
      }

      stack.push(x1, y1, x, y,  x, y1, x2, y,  x, y, x2, y2,  x1, y, x, y2)
    }
  }

  const seedCorner = () => MIN_VALUE + Math.floor(rand() * MAX_VALUE)
  put(0, 0, seedCorner())
  put(w - 1, 0, seedCorner())
  put(w - 1, h - 1, seedCorner())
  put(0, h - 1, seedCorner())

  subDivide(0, 0, w - 1, h - 1)
  return px
}
