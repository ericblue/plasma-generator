/** Seeded PRNG (mulberry32) so any image can be reproduced from its seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const randomSeed = (): number => (Math.random() * 0xffffffff) >>> 0
export const formatSeed = (s: number): string =>
  '0x' + (s >>> 0).toString(16).toUpperCase().padStart(8, '0')

export function parseSeed(text: string): number | null {
  const t = text.trim()
  if (!t) return null
  const n = t.startsWith('0x') || t.startsWith('0X') ? parseInt(t.slice(2), 16) : parseInt(t, 10)
  return Number.isFinite(n) ? n >>> 0 : null
}
