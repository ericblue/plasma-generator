import { expect, test } from '@playwright/test'

test('creative controls stay shareable and portable', async ({ page }) => {
  await page.goto('/?type=demoscene&profile=authentic&quality=performance&paused=1')
  await expect(page.getByRole('button', { name: 'Plasma Lab', exact: true })).toHaveClass(/active/)

  await page.locator('#surprise').click()
  await expect.poll(() => new URL(page.url()).searchParams.get('surprise')).not.toBeNull()
  await expect(page.locator('#demo-pattern option')).toHaveCount(9)

  await page.locator('#demo-pattern').selectOption('mandelbrot')
  await expect(page.locator('#frequency-label')).toHaveText('Zoom / detail')
  await page.locator('#demo-pattern').selectOption('classic')
  await expect(page.locator('#frequency-label')).toHaveText('Frequency')

  await page.locator('#palette').selectOption('custom')
  await expect(page.locator('#custom-palette')).toBeVisible()
  await expect(page.locator('#custom-colors input[type=color]')).toHaveCount(6)

  await page.locator('#loop-seconds').selectOption('5')
  await expect(page.locator('#readout')).toContainText('seamless 5s loop')

  await page.locator('#render-profile').selectOption('hd')

  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()

  await page.locator('#presentation').click()
  await expect(page.locator('#stage')).toHaveClass(/presentation/)
  const presentationFrame = await page.locator('#frame').boundingBox()
  expect(presentationFrame).not.toBeNull()
  expect(presentationFrame!.width).toBeGreaterThan(viewport!.width * 0.95)
  await page.keyboard.press('h')
  await expect(page.locator('#stage')).not.toHaveClass(/presentation/)

  await page.locator('#fullscreen').click()
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true)
  const fullscreenFrame = await page.locator('#frame').boundingBox()
  expect(fullscreenFrame).not.toBeNull()
  expect(fullscreenFrame!.width).toBeGreaterThan(viewport!.width * 0.95)
  expect(fullscreenFrame!.height).toBeGreaterThan(viewport!.height * 0.75)
  await page.keyboard.press('f')
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false)

  const downloadPromise = page.waitForEvent('download')
  await page.locator('#preset-export').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('plasma-generator-plasma-lab-preset.json')
})

test('Plasma Lab launches first and modes keep appropriate render defaults', async ({ page }) => {
  // This test switches to the UHD profile (3840x2160). CI has no GPU, so that
  // frame is rasterized on the CPU by SwiftShader and blocks the main thread for
  // far longer than a desktop GPU would take -- long enough that the next click
  // cannot go through inside the local budget.
  test.setTimeout(process.env['CI'] ? 180_000 : 60_000)
  await page.goto('/')

  const tabs = page.locator('.tab')
  await expect(tabs.first()).toHaveAttribute('data-type', 'demoscene')
  await expect(page.getByRole('button', { name: 'Plasma Lab', exact: true })).toHaveClass(/active/)
  await expect(page.locator('#demo-scene')).toHaveValue('iceFlow')
  await expect(page.locator('#demo-pattern')).toHaveValue('classic')
  await expect(page.locator('#palette')).toHaveValue('ice')
  await expect(page.locator('#render-profile')).toHaveValue('hd')
  await expect(page.locator('#sampling')).toHaveValue('smooth')

  await page.locator('#render-profile').selectOption('uhd')
  const mulveyTab = page.getByRole('button', { name: 'Mulvey 1988', exact: true })
  await mulveyTab.click()
  await expect(mulveyTab).toHaveClass(/active/)
  await expect(page.locator('#palette')).toHaveValue('mulvey')
  await expect(page.locator('#render-profile')).toHaveValue('authentic')
  await expect(page.locator('#sampling')).toHaveValue('pixel')

  const labTab = page.getByRole('button', { name: 'Plasma Lab', exact: true })
  await labTab.click()
  await expect(labTab).toHaveClass(/active/)
  await expect(page.locator('#palette')).toHaveValue('ice')
  await expect(page.locator('#render-profile')).toHaveValue('uhd')
  await expect(page.locator('#sampling')).toHaveValue('smooth')

  const tomTab = page.getByRole('button', { name: "Tom's 1994", exact: true })
  await tomTab.click()
  await expect(tomTab).toHaveClass(/active/)
  await expect(page.locator('#render-profile')).toHaveValue('authentic')
  await expect(page.locator('#sampling')).toHaveValue('pixel')
  await expect(page.locator('#tom-swim')).not.toBeChecked()
})

test('each generator resets to clean-launch defaults', async ({ page }) => {
  test.setTimeout(60_000)
  const scenarios = [
    {
      url: '/?type=mulvey&src=original&f=5&cd=1&profile=authentic&sampling=glow&pal=fire&spd=70&quality=full&paused=1',
      label: 'Mulvey 1988',
      profile: 'authentic',
      sampling: 'pixel',
      speed: '24',
      verify: async () => {
        await expect(page.locator('#mulvey-source')).toHaveValue('generated')
        await expect(page.locator('#roughness')).toHaveValue('2')
        await expect(page.locator('#centre')).not.toBeChecked()
        await expect(page.locator('#palette')).toHaveValue('mulvey')
      },
    },
    {
      url: '/?type=tom&tseed=0x1234&tr=63&swim=0&tpal=ice&profile=authentic&sampling=glow&spd=80&quality=performance&paused=1',
      label: "Tom's 1994",
      profile: 'authentic',
      sampling: 'pixel',
      speed: '24',
      verify: async () => {
        await expect(page.locator('#tom-roughness')).toHaveValue('255')
        await expect(page.locator('#tom-swim')).not.toBeChecked()
        await expect(page.locator('#palette')).toHaveValue('tom')
      },
    },
    {
      url: '/?type=demoscene&pattern=memoryTunnel&finish=trails&motion=2&intensity=1.8&sc=30&pal=tunnelBlueGold&spd=8&loop=20&profile=hd&sampling=glow&quality=full&paused=1',
      label: 'Plasma Lab',
      profile: 'hd',
      sampling: 'smooth',
      speed: '19',
      verify: async () => {
        await expect(page.locator('#demo-scene')).toHaveValue('iceFlow')
        await expect(page.locator('#demo-pattern')).toHaveValue('classic')
        await expect(page.locator('#demo-finish')).toHaveValue('clean')
        await expect(page.locator('#sineScale')).toHaveValue('9')
        await expect(page.locator('#demo-motion')).toHaveValue('0.6')
        await expect(page.locator('#demo-intensity')).toHaveValue('0.9')
        await expect(page.locator('#palette')).toHaveValue('ice')
      },
    },
  ]

  for (const scenario of scenarios) {
    await page.goto(scenario.url)
    await expect(page.locator('#readout')).not.toHaveText('')
    await page.locator('.reset-defaults:visible').click()

    await expect(page.locator('#action-status')).toHaveText(`${scenario.label} reset to defaults.`)
    await expect(page.locator('#render-profile')).toHaveValue(scenario.profile)
    await expect(page.locator('#sampling')).toHaveValue(scenario.sampling)
    await expect(page.locator('#preview-quality')).toHaveValue('balanced')
    await expect(page.locator('#speed')).toHaveValue(scenario.speed)
    await expect(page.locator('#loop-seconds')).toHaveValue('0')
    await expect(page.locator('#record-seconds')).toHaveValue('5')
    await expect(page.locator('#show-diagnostics')).not.toBeChecked()
    await expect(page.locator('#pause')).toHaveText('Pause')
    await scenario.verify()

    await expect.poll(() => {
      const query = new URL(page.url()).searchParams
      return [query.get('profile'), query.get('sampling'), query.get('spd'), query.get('paused')]
    }).toEqual([scenario.profile, scenario.sampling, scenario.speed, '0'])
  }
})
