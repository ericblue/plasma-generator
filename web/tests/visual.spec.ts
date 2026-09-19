import { expect, test } from '@playwright/test'

test('Fractal Swim remains visually stable', async ({ page }) => {
  await page.goto('/?type=demoscene&profile=hd&sampling=smooth&pal=vgaCandy&spd=24&sc=11&pattern=fractalSwim&finish=clean&motion=.7&intensity=1&quality=balanced&paused=1')
  await expect(page.locator('#readout')).toContainText('Fractal Swim')
  await expect(page.locator('#view')).toHaveScreenshot('fractal-swim.png')
})

test('default Ice Flow remains visually stable', async ({ page }) => {
  await page.goto('/?type=demoscene&profile=hd&sampling=smooth&pal=ice&spd=19&sc=9&pattern=classic&finish=clean&motion=.6&intensity=.9&quality=balanced&paused=1')
  await expect(page.locator('#readout')).toContainText('Ice Flow')
  await expect(page.locator('#view')).toHaveScreenshot('ice-flow.png')
})

test('Mulvey generated plasma remains visually stable', async ({ page }) => {
  await page.goto('/?type=mulvey&src=generated&seed=0x1988&f=2&profile=authentic&sampling=pixel&pal=mulvey&spd=24&quality=full&paused=1')
  await expect(page.locator('#readout')).toContainText('seed 0x00001988')
  await expect(page.locator('#view')).toHaveScreenshot('mulvey-1988.png')
})

test('Starry Mandala remains visually stable', async ({ page }) => {
  await page.goto('/?type=demoscene&profile=hd&sampling=glow&pal=starryNight&spd=12&sc=10&pattern=mandala&finish=bloom&motion=.6&intensity=1.1&loop=5&quality=balanced&paused=1')
  await expect(page.locator('#readout')).toContainText('Starry Mandala')
  await expect(page.locator('#view')).toHaveScreenshot('starry-mandala.png')
})

test('Classic Mandelbrot remains visually stable', async ({ page }) => {
  await page.goto('/?type=demoscene&profile=hd&sampling=smooth&pal=starryNight&spd=9&sc=8&pattern=mandelbrot&finish=clean&motion=.5&intensity=1.1&quality=balanced&paused=1')
  await expect(page.locator('#readout')).toContainText('Mandelbrot Voyage')
  await expect(page.locator('#view')).toHaveScreenshot('classic-mandelbrot.png')
})

test('Memory Mandelbrot recurrence remains visually stable', async ({ page }) => {
  await page.goto('/?type=demoscene&profile=hd&sampling=glow&pal=starryNight&spd=10&sc=28&pattern=memoryMandelbrot&finish=bloom&motion=.5&intensity=1.2&quality=balanced&paused=1')
  await expect(page.locator('#readout')).toContainText('Memory Spiral')
  await expect(page.locator('#view')).toHaveScreenshot('memory-mandelbrot.png')
})

test('Memory Tunnel remains visually stable', async ({ page }) => {
  await page.goto('/?type=demoscene&profile=hd&sampling=glow&pal=tunnelBlueGold&spd=8&sc=20&pattern=memoryTunnel&finish=bloom&motion=.8&intensity=1.2&quality=performance&paused=1')
  await expect(page.locator('#readout')).toContainText('continuous zoom')
  await expect(page.locator('#view')).toHaveScreenshot('memory-tunnel.png')
})
