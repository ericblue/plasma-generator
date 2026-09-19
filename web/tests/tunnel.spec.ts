import { expect, test } from '@playwright/test'

test.use({ reducedMotion: 'no-preference' })

test('Memory Tunnel advances continuously', async ({ page }) => {
  await page.goto('/?type=demoscene&profile=authentic&sampling=smooth&pal=tunnelBlueGold&spd=8&sc=20&pattern=memoryTunnel&finish=clean&motion=.8&intensity=1.2&quality=full&paused=0')
  const first = await page.locator('#view').screenshot()
  await page.waitForTimeout(750)
  const later = await page.locator('#view').screenshot()
  expect(later.equals(first)).toBe(false)
})
