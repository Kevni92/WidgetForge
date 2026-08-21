import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'

const fixturePath = '?fixture=layout-acceptance'

async function loadFixture(page: Page): Promise<void> {
  await page.goto(fixturePath)
  await expect(page.locator('[data-layout-acceptance-fixture]')).toBeVisible()
  await expect(frame(page, 'center-window')).toBeVisible()
}

function frame(page: Page, instanceId: string): Locator {
  return page.locator(`.wf-window-frame[data-window-instance-id="${instanceId}"]`)
}

function relation(page: Page, targetId: string): Locator {
  return page.locator(`[data-window-layout-relation][aria-label*="${targetId}"]`)
}

async function enterEditMode(page: Page): Promise<void> {
  await page.locator('[data-workspace-edit-toggle]').click()
  await expect(page.locator('[data-workspace-edit-toggle]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Exit layout edit mode' })).toBeVisible()
  await expect(page.locator('[data-workspace-edit-status]')).toHaveText('Layout editing')
  await expect(page.locator('[data-window-instance-id="center-window"] [data-layout-content="dimmed"]')).toHaveAttribute('inert', '')
}

async function selectWindow(page: Page, instanceId: string): Promise<void> {
  const selected = frame(page, instanceId)
  await selected.locator('[data-layout-edit-interaction-layer]').click({ position: { x: 80, y: 100 } })
  await expect(page.locator('[data-selected-window-id]')).toHaveText(instanceId)
  await expect(page.locator('[data-window-constraint-handles]')).toBeVisible()
}

async function chooseKeyboardTarget(page: Page, optionPattern: RegExp): Promise<void> {
  const picker = page.locator('[data-window-constraint-keyboard-picker]')
  await expect(picker).toBeVisible()
  await picker.getByRole('option', { name: optionPattern }).click()
  await expect(picker).toBeHidden()
}

async function createConstraintByKeyboard(page: Page, sourceEdge: 'left' | 'right' | 'top' | 'bottom', optionPattern: RegExp, targetId: string): Promise<void> {
  await page.locator(`[data-window-constraint-handle="${sourceEdge}"]`).click()
  await chooseKeyboardTarget(page, optionPattern)
  if (targetId === 'workspace') {
    await expect(page.locator(`[data-window-layout-relation][aria-label*="${sourceEdge} to workspace"]`)).toHaveCount(1)
  } else {
    await expect(relation(page, targetId)).toHaveCount(1)
  }
}

async function createConstraintByPointer(page: Page, info: TestInfo): Promise<void> {
  const sourceHandle = page.locator('[data-window-constraint-handle="right"]')
  const sourceBox = await sourceHandle.boundingBox()
  const targetBox = await frame(page, 'right-menu').boundingBox()
  if (!sourceBox || !targetBox) throw new Error('Constraint source or target was not measurable')
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox.x, targetBox.y + targetBox.height / 2, { steps: 10 })
  await expect(page.locator('[data-window-constraint-drag-line]')).toBeAttached()
  await expect(page.locator('[data-window-constraint-drag-line]')).toHaveClass(/wf-window-layout-relation--active/)
  await expect(page.locator('[data-window-constraint-target]')).toHaveAttribute('data-window-constraint-target-id', 'right-menu')
  await expect(page.locator('[data-window-constraint-target]')).toHaveAttribute('data-window-constraint-target-edge', 'left')
  await expect(page.locator('[data-window-constraint-ghost]')).toBeVisible()
  await page.screenshot({ path: info.outputPath('screenshots/04-constraint-drag.png'), fullPage: true })
  await page.mouse.up()
  await expect(relation(page, 'right-menu')).toHaveCount(1)
}

async function setInspectorDistance(page: Page, edge: 'left' | 'right', value: string): Promise<void> {
  const card = page.locator(`[data-window-constraint-card="${edge}"]`)
  await card.click()
  const input = page.locator(`[data-layout-constraint-offset="${edge}"]`)
  await input.click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.type(value)
  await expect(page.locator('[data-layout-preview-overlay]')).toBeVisible()
  await input.press('Enter')
  await expect(page.locator('[data-layout-preview-overlay]')).toBeHidden()
  await expect(input).toHaveValue(value)
}

async function physicalGap(page: Page, sourceId: string, targetId: string): Promise<number> {
  const source = await frame(page, sourceId).boundingBox()
  const target = await frame(page, targetId).boundingBox()
  if (!source || !target) throw new Error('Constraint geometry was not measurable')
  return target.x - (source.x + source.width)
}

async function physicalDistance(page: Page, sourceId: string, sourceEdge: 'left' | 'right', targetId: string, targetEdge: 'left' | 'right'): Promise<number> {
  const source = await frame(page, sourceId).boundingBox()
  const target = await frame(page, targetId).boundingBox()
  if (!source || !target) throw new Error('Constraint geometry was not measurable')
  const sourceCoordinate = sourceEdge === 'left' ? source.x : source.x + source.width
  const targetCoordinate = targetEdge === 'left' ? target.x : target.x + target.width
  return sourceEdge === 'left' ? sourceCoordinate - targetCoordinate : targetCoordinate - sourceCoordinate
}

async function checkpoint(page: Page, info: TestInfo, name: string): Promise<void> {
  await page.screenshot({ path: info.outputPath(`screenshots/${name}.png`), fullPage: true })
}

async function selectDock(page: Page, dockId: string): Promise<void> {
  await page.locator(`[data-dock-id="${dockId}"]`).dispatchEvent('pointerdown')
  await expect(page.locator('[data-layout-inspector-selection-kind]')).toHaveText(`DOCK · ${dockId}`)
}

async function selectPane(page: Page, paneId: string): Promise<void> {
  await page.locator(`[data-pane-id="${paneId}"]`).dispatchEvent('pointerdown')
  await expect(page.locator('[data-layout-inspector-selection-kind]')).toHaveText(new RegExp(`PANE · ${paneId}$`))
}

async function openStyles(page: Page): Promise<void> {
  await page.locator('[data-layout-inspector-tab="styles"]').click()
  await expect(page.locator('[data-layout-inspector-styles]')).toBeVisible()
}

async function commitStyleInput(page: Page, selector: string, value: string): Promise<void> {
  const input = page.locator(selector)
  await input.fill(value)
  await input.press('Enter')
  await expect(page.locator('[data-style-error]')).toBeHidden()
}

async function setBorderState(page: Page, side: 'top' | 'right' | 'bottom' | 'left', enabled: boolean): Promise<void> {
  const button = page.locator(`[data-style-border-side="${side}"]`)
  const current = await button.getAttribute('aria-pressed')
  if ((current === 'true') !== enabled) await button.click()
  await expect(button).toHaveAttribute('aria-pressed', enabled ? 'true' : 'false')
}

async function expectOnlyBorder(page: Page, host: Locator, side: 'top' | 'right' | 'bottom' | 'left', width = '1px'): Promise<void> {
  const style = await host.getAttribute('style')
  if (!style) throw new Error(`Expected surface style for ${side} border`)
  for (const candidate of ['top', 'right', 'bottom', 'left'] as const) {
    expect(style).toContain(`--wf-surface-border-${candidate}-width: ${candidate === side ? width : '0px'}`)
  }
}

function overlaps(left: { x: number; y: number; width: number; height: number }, right: { x: number; y: number; width: number; height: number }): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('widgetforge.layout-acceptance-test-initialized') === 'true') return
    localStorage.clear()
    sessionStorage.setItem('widgetforge.layout-acceptance-test-initialized', 'true')
  })
})

test('runs the real Edit → Select → Connect → Resize → Inspector → Workspace resize → Done flow', async ({ page }, info) => {
  await loadFixture(page)
  await expect(page.locator('[aria-label="Anchor window to workspace"]')).toHaveCount(0)
  await expect(page.locator('.wf-window-dock-picker')).toHaveCount(0)
  await page.locator('[data-window-instance-id="center-window"] [data-layout-content-action]').click()
  await expect(page.locator('[data-layout-content-details]')).toBeVisible()
  await checkpoint(page, info, '01-normal-mode')

  await enterEditMode(page)
  await expect(page.locator('[data-layout-inspector-empty]')).toBeVisible()
  await expect(page.locator('[data-layout-acceptance-undo]')).toBeDisabled()
  await checkpoint(page, info, '02-edit-mode-empty')

  await selectWindow(page, 'center-window')
  await expect(page.locator('[data-window-constraint-handle]')).toHaveCount(4)
  await expect(page.locator('[data-window-layout-resize-handle]')).toHaveCount(8)
  await expect(page.locator('[data-selected-window-title]')).toHaveText('Center Canvas')
  await checkpoint(page, info, '03-selected-window')

  await page.locator('[data-layout-inspector-toggle]').click()
  await expect(page.locator('[data-layout-inspector]')).toHaveClass(/wf-layout-inspector--collapsed/)
  await createConstraintByPointer(page, info)
  await page.locator('[data-layout-inspector-toggle]').click()
  await expect(page.locator('[data-layout-inspector]')).not.toHaveClass(/wf-layout-inspector--collapsed/)
  await expect(page.locator('[data-layout-constraint-target-label]').filter({ hasText: 'Right Menu · right-menu · left' })).toBeVisible()
  await checkpoint(page, info, '05-committed-constraint')

  await page.locator('[data-layout-inspector-toggle]').click()
  await expect(page.locator('[data-layout-inspector]')).toHaveClass(/wf-layout-inspector--collapsed/)
  const beforeResize = await frame(page, 'center-window').boundingBox()
  const resizeHandle = page.locator('[data-window-layout-resize-handle="right"]')
  const resizeBox = await resizeHandle.boundingBox()
  if (!beforeResize || !resizeBox) throw new Error('Resize geometry was not measurable')
  const resizeY = resizeBox.y + Math.min(40, resizeBox.height / 2)
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeY)
  await page.mouse.down()
  await page.mouse.move(resizeBox.x + resizeBox.width / 2 - 36, resizeY, { steps: 8 })
  await expect(page.locator('[data-layout-preview-overlay]')).toBeVisible()
  await expect(relation(page, 'right-menu')).toHaveCount(1)
  await page.mouse.up()
  await expect(page.locator('[data-layout-preview-overlay]')).toBeHidden()
  await page.locator('[data-layout-inspector-toggle]').click()
  await expect(page.locator('[data-layout-inspector]')).not.toHaveClass(/wf-layout-inspector--collapsed/)
  await expect(page.locator('[data-layout-constraint-target-label]').filter({ hasText: 'Right Menu · right-menu · left' })).toBeVisible()

  await setInspectorDistance(page, 'right', '20')
  await expect.poll(() => physicalGap(page, 'center-window', 'right-menu')).toBeCloseTo(20, 0)
  await checkpoint(page, info, '06-inspector-20px')

  await page.setViewportSize({ width: 1024, height: 768 })
  await expect.poll(() => physicalGap(page, 'center-window', 'right-menu')).toBeCloseTo(20, 0)
  await checkpoint(page, info, '07-workspace-resized')

  await page.locator('[data-workspace-edit-toggle]').click()
  await expect(page.locator('[data-workspace-edit-mode]')).toHaveAttribute('data-workspace-edit-mode', 'false')
  await expect(page.locator('[data-window-constraint-handles]')).toBeHidden()
  await expect(page.locator('[data-layout-inspector]')).toBeHidden()
  await expect(page.locator('[data-window-instance-id="center-window"] [data-layout-content="dimmed"]')).toBeHidden()
  const normalAction = page.locator('[data-window-instance-id="center-window"] [data-layout-content-action]')
  await normalAction.click()
  await expect(page.locator('[data-layout-content-details]')).toBeHidden()
  await normalAction.click()
  await expect(page.locator('[data-layout-content-details]')).toBeVisible()
})

test('keeps locked edge surfaces visually stable in normal mode and overlays selection only in edit mode', async ({ page }) => {
  await loadFixture(page)
  for (const instanceId of ['left-menu', 'right-menu']) {
    const host = frame(page, instanceId)
    const shell = host.locator('.wf-window-shell')
    await expect(host).toHaveAttribute('data-window-layout-locked', 'true')
    await shell.click()
    await expect(shell).toHaveAttribute('data-focused', 'true')
    await expect(shell).toHaveAttribute('data-window-visual-focused', 'false')
    await expect(host).not.toHaveAttribute('data-layout-selection')
  }

  await enterEditMode(page)
  await selectWindow(page, 'left-menu')
  await expect(frame(page, 'left-menu')).toHaveAttribute('data-layout-selection', 'selected')
  await expect(frame(page, 'left-menu').locator('.wf-window-shell')).toHaveAttribute('data-window-visual-focused', 'false')
  await page.locator('[data-workspace-edit-toggle]').click()
  await expect(frame(page, 'left-menu')).not.toHaveAttribute('data-layout-selection')
})

test('selects the Topnav dock and Left Menu window through the unified inspector selection', async ({ page }) => {
  await loadFixture(page)
  await enterEditMode(page)

  await page.locator('[data-dock-id="topnav"]').dispatchEvent('pointerdown')
  await expect(page.locator('[data-layout-inspector-selection-kind]')).toHaveText('DOCK · topnav')
  await page.locator('[data-layout-inspector-tab="styles"]').click()
  await expect(page.locator('[data-layout-inspector-styles]')).toBeVisible()
  await page.locator('[data-style-background-mode]').selectOption('transparent')
  await expect(page.locator('[data-dock-id="topnav"]')).toHaveAttribute('style', /--wf-surface-background: transparent/)

  await selectWindow(page, 'left-menu')
  await expect(page.locator('[data-layout-inspector-selection-kind]')).toHaveText('WINDOW · left-menu')
  await expect(page.locator('[data-layout-inspector-styles]')).toBeVisible()
  await page.locator('[data-layout-inspector-tab="object"]').click()
  await expect(page.locator('[data-layout-inspector-object="window"]')).toBeVisible()
})

test('moves, minimizes, restores, and clamps the editor inspector without changing workspace geometry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 768 })
  await loadFixture(page)
  await enterEditMode(page)
  await selectWindow(page, 'center-window')

  const inspector = page.locator('[data-layout-inspector]')
  await expect(inspector).toHaveAttribute('data-layout-inspector-mode', 'docked')
  const initialInspectorBox = await inspector.boundingBox()
  const rightMenuBox = await frame(page, 'right-menu').boundingBox()
  if (!initialInspectorBox || !rightMenuBox) throw new Error('Inspector geometry was not measurable')
  expect(overlaps(initialInspectorBox, rightMenuBox)).toBe(true)

  const grip = page.locator('[data-layout-inspector-grip]')
  await page.locator('[data-layout-inspector-dock]').click()
  await expect(inspector).toHaveAttribute('data-layout-inspector-mode', 'floating')
  const floatingBefore = await inspector.boundingBox()
  const gripBox = await grip.boundingBox()
  if (!floatingBefore || !gripBox) throw new Error('Floating inspector geometry was not measurable')
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(gripBox.x - 500, gripBox.y - 100, { steps: 10 })
  await page.mouse.up()
  const floatingAfter = await inspector.boundingBox()
  if (!floatingAfter) throw new Error('Moved inspector geometry was not measurable')
  expect(floatingAfter.x).toBeLessThan(floatingBefore.x - 200)
  expect(floatingAfter.x).toBeGreaterThanOrEqual(0)
  expect(floatingAfter.y).toBeGreaterThanOrEqual(0)

  await selectWindow(page, 'right-menu')
  await expect(page.locator('[data-selected-window-id]')).toHaveText('right-menu')
  await expect(inspector).toHaveAttribute('data-layout-inspector-mode', 'floating')
  await page.locator('[data-layout-inspector-minimize]').click()
  await expect(inspector).toHaveAttribute('data-layout-inspector-mode', 'minimized')
  const minimizedBox = await inspector.boundingBox()
  if (!minimizedBox) throw new Error('Minimized inspector geometry was not measurable')
  expect(minimizedBox.width).toBeLessThan(180)

  await frame(page, 'left-menu').locator('[data-layout-edit-interaction-layer]').click({ position: { x: 80, y: 100 } })
  await expect(frame(page, 'left-menu')).toHaveAttribute('data-layout-selection', 'selected')
  await expect(inspector).toHaveAttribute('data-layout-inspector-mode', 'minimized')
  await page.locator('[data-layout-inspector-restore]').click()
  await expect(inspector).toHaveAttribute('data-layout-inspector-mode', 'floating')
  await expect(page.locator('[data-selected-window-id]')).toHaveText('left-menu')
  await page.locator('[data-layout-inspector-dock]').click()
  await expect(inspector).toHaveAttribute('data-layout-inspector-mode', 'docked')

  for (const viewport of [{ width: 1024, height: 768 }, { width: 720, height: 600 }]) {
    await page.setViewportSize(viewport)
    await expect(inspector).toBeVisible()
    const box = await inspector.boundingBox()
    if (!box) throw new Error('Responsive inspector geometry was not measurable')
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
    expect(box.y).toBeGreaterThanOrEqual(0)
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', viewport.width)
  }
})

test('covers keyboard targeting, workspace edge constraints, invalid input, cancel, and cycle prevention', async ({ page }, info) => {
  await loadFixture(page)
  await enterEditMode(page)
  await selectWindow(page, 'center-window')

  await page.locator('[data-window-constraint-handle="right"]').click()
  const picker = page.locator('[data-window-constraint-keyboard-picker]')
  await expect(picker.getByRole('option', { name: /Right Menu .* left/ })).toBeVisible()
  await expect(picker.getByRole('option', { name: /Workspace .* top/ })).toHaveCount(0)
  await chooseKeyboardTarget(page, /Right Menu .* left/)
  await setInspectorDistance(page, 'right', '20')

  await page.locator('[data-window-constraint-handle="left"]').click()
  await chooseKeyboardTarget(page, /Workspace .* left/i)
  await expect(page.locator('[data-layout-constraint-target-label]').filter({ hasText: 'Workspace · left' })).toBeVisible()
  await setInspectorDistance(page, 'left', '16')
  await checkpoint(page, info, '08-workspace-edge')

  const invalid = page.locator('[data-layout-constraint-offset="right"]')
  await invalid.fill('')
  await expect(page.locator('[data-layout-inspector-error]')).toContainText('Distance')
  await expect(relation(page, 'right-menu')).toHaveCount(1)
  await expect(relation(page, 'workspace left')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-layout-inspector-error]')).toBeHidden()

  await page.locator('[data-layout-inspector-toggle]').click()
  await expect(page.locator('[data-layout-inspector]')).toHaveClass(/wf-layout-inspector--collapsed/)
  await page.locator('[data-window-constraint-handle="right"]').click()
  await chooseKeyboardTarget(page, /Right Menu .* left/)
  await selectWindow(page, 'right-menu')
  await page.locator('[data-window-constraint-handle="left"]').click()
  const cyclePicker = page.locator('[data-window-constraint-keyboard-picker]')
  await expect(cyclePicker).toBeVisible()
  await expect(cyclePicker.getByRole('option', { name: /Center Canvas · center-window · right/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
})

test('checks Stretch geometry, exact distances, and resize preservation', async ({ page }, info) => {
  await loadFixture(page)
  await page.locator('[data-layout-acceptance-new-window]').click()
  const created = page.locator('.wf-window-frame[data-window-instance-id^="acceptance-window-"]').last()
  await expect(created).toBeVisible()
  const createdId = await created.getAttribute('data-window-instance-id')
  if (!createdId) throw new Error('New acceptance window has no instance id')
  await enterEditMode(page)
  await selectWindow(page, createdId)
  await createConstraintByKeyboard(page, 'left', /Left Menu .* right/, 'left-menu')
  await createConstraintByKeyboard(page, 'right', /Right Menu .* left/, 'right-menu')
  await expect(page.locator('[data-layout-axis-mode="horizontal"]')).toHaveText('Stretch · calculated size')
  await expect(page.locator('[data-layout-derived-size="horizontal"]')).toBeVisible()
  await expect(page.locator('[data-layout-size="horizontal"]')).toHaveCount(0)
  await setInspectorDistance(page, 'left', '12')
  await setInspectorDistance(page, 'right', '20')
  await expect.poll(() => physicalDistance(page, createdId, 'left', 'left-menu', 'right')).toBeCloseTo(12, 0)
  await expect.poll(() => physicalGap(page, createdId, 'right-menu')).toBeCloseTo(20, 0)
  await checkpoint(page, info, '10-stretch-between-menus')
})

test('records constraint creation, direct resize, and Inspector input as three undoable actions', async ({ page }) => {
  await loadFixture(page)
  await enterEditMode(page)
  await selectWindow(page, 'center-window')
  await createConstraintByKeyboard(page, 'right', /Right Menu .* left/, 'right-menu')
  await page.locator('[data-layout-inspector-toggle]').click()
  await expect(page.locator('[data-layout-inspector]')).toHaveClass(/wf-layout-inspector--collapsed/)
  const resizeHandle = page.locator('[data-window-layout-resize-handle="right"]')
  const resizeBox = await resizeHandle.boundingBox()
  if (!resizeBox) throw new Error('Resize geometry was not measurable')
  const resizeY = resizeBox.y + Math.min(40, resizeBox.height / 2)
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeY)
  await page.mouse.down()
  await page.mouse.move(resizeBox.x + resizeBox.width / 2 - 30, resizeY, { steps: 6 })
  await expect(page.locator('[data-layout-preview-overlay]')).toBeVisible()
  await page.mouse.up()
  await page.locator('[data-layout-inspector-toggle]').click()
  await expect(page.locator('[data-layout-inspector]')).not.toHaveClass(/wf-layout-inspector--collapsed/)
  await setInspectorDistance(page, 'right', '20')
  await expect(relation(page, 'right-menu')).toHaveCount(1)

  await page.locator('[data-layout-acceptance-undo]').click()
  await page.locator('[data-layout-acceptance-undo]').click()
  await page.locator('[data-layout-acceptance-undo]').click()
  await expect(relation(page, 'right-menu')).toHaveCount(0)
  await page.locator('[data-layout-acceptance-redo]').click()
  await page.locator('[data-layout-acceptance-redo]').click()
  await page.locator('[data-layout-acceptance-redo]').click()
  await expect(relation(page, 'right-menu')).toHaveCount(1)
  await expect(page.locator('[data-layout-constraint-offset="right"]')).toHaveValue('20')
})

test('restores a committed direct constraint and 20px gap through the consumer persistence path', async ({ page }) => {
  await loadFixture(page)
  await enterEditMode(page)
  await selectWindow(page, 'center-window')
  await createConstraintByKeyboard(page, 'right', /Right Menu .* left/, 'right-menu')
  await setInspectorDistance(page, 'right', '20')
  await page.locator('[data-workspace-edit-toggle]').click()
  await page.reload()
  await expect(page.locator('[data-layout-acceptance-fixture]')).toBeVisible()
  await enterEditMode(page)
  await selectWindow(page, 'center-window')
  await expect(relation(page, 'right-menu')).toHaveCount(1)
  await expect(page.locator('[data-layout-constraint-offset="right"]')).toHaveValue('20')
  await expect.poll(() => physicalGap(page, 'center-window', 'right-menu')).toBeCloseTo(20, 0)
})

test('keeps static chrome separate from editor selection and binds a window to workspace bottom without dock conversion', async ({ page }, info) => {
  await loadFixture(page)
  await expect(page.locator('[aria-label="Anchor window to workspace"]')).toHaveCount(0)
  await expect(page.locator('.wf-window-dock-picker')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Anchor window to workspace/i })).toHaveCount(0)

  await page.locator('[data-dock-id="topnav"]').click()
  await expect(page.locator('[data-dock-id="topnav"]')).not.toHaveAttribute('data-layout-selection')
  await frame(page, 'left-menu').locator('.wf-window-shell').click()
  await expect(frame(page, 'left-menu')).not.toHaveAttribute('data-layout-selection')
  await expect(frame(page, 'left-menu').locator('.wf-window-shell')).toHaveAttribute('data-window-visual-focused', 'false')

  const leftBefore = await frame(page, 'left-menu').boundingBox()
  const rightBefore = await frame(page, 'right-menu').boundingBox()
  if (!leftBefore || !rightBefore) throw new Error('Static menu geometry was not measurable')

  await enterEditMode(page)
  await selectWindow(page, 'center-window')
  await createConstraintByKeyboard(page, 'bottom', /Workspace .* bottom/i, 'workspace')
  await expect(frame(page, 'center-window')).toHaveCount(1)
  await expect(page.locator('.wf-window-frame[data-window-instance-id="center-window"]')).toHaveCount(1)
  await expect(page.locator('[data-dock-id="topnav"]')).toHaveCount(1)
  await expect(page.locator('[data-dock-id="topnav"]')).toHaveAttribute('data-dock-position', 'top')
  const leftAfter = await frame(page, 'left-menu').boundingBox()
  const rightAfter = await frame(page, 'right-menu').boundingBox()
  if (!leftAfter || !rightAfter) throw new Error('Static menu geometry after constraint was not measurable')
  expect(leftAfter).toMatchObject({ x: leftBefore.x, y: leftBefore.y, width: leftBefore.width, height: leftBefore.height })
  expect(rightAfter).toMatchObject({ x: rightBefore.x, y: rightBefore.y, width: rightBefore.width, height: rightBefore.height })
  await checkpoint(page, info, '11-workspace-bottom-constraint')

  await page.locator('[data-workspace-edit-toggle]').click()
  await expect(page.locator('[data-layout-inspector]')).toBeHidden()
  await expect(frame(page, 'center-window')).not.toHaveAttribute('data-layout-selection')
})

test('applies scoped Topnav and Left Menu SurfaceStyles without adding normal-mode focus borders', async ({ page }, info) => {
  await loadFixture(page)
  await enterEditMode(page)

  await selectDock(page, 'topnav')
  await openStyles(page)
  await page.locator('[data-style-background-mode]').selectOption('custom')
  await commitStyleInput(page, '[data-style-background-color]', '#193044')
  await setBorderState(page, 'top', false)
  await setBorderState(page, 'right', false)
  await setBorderState(page, 'bottom', true)
  await setBorderState(page, 'left', false)
  await page.locator('[data-style-border-target]').selectOption('bottom')
  await commitStyleInput(page, '[data-style-border-width]', '1')
  await commitStyleInput(page, '[data-style-padding-all]', '6')
  await page.locator('[data-style-padding-linked]').click()
  await commitStyleInput(page, '[data-style-padding-side="left"]', '12')
  await commitStyleInput(page, '[data-style-padding-side="right"]', '12')
  await commitStyleInput(page, '[data-style-radius]', '0')
  await page.locator('[data-style-shadow]').selectOption('none')
  const topnav = page.locator('[data-dock-id="topnav"]')
  await expectOnlyBorder(page, topnav, 'bottom')
  await expect(topnav).toHaveAttribute('style', /--wf-surface-padding-top: 6px/)
  await expect(topnav).toHaveAttribute('style', /--wf-surface-padding-left: 12px/)
  await checkpoint(page, info, '12-topnav-styles')

  await selectWindow(page, 'left-menu')
  await openStyles(page)
  await page.locator('[data-style-background-mode]').selectOption('custom')
  await commitStyleInput(page, '[data-style-background-color]', '#252f3b')
  await setBorderState(page, 'top', false)
  await setBorderState(page, 'right', true)
  await setBorderState(page, 'bottom', false)
  await setBorderState(page, 'left', false)
  await page.locator('[data-style-border-target]').selectOption('right')
  await commitStyleInput(page, '[data-style-border-width]', '1')
  await commitStyleInput(page, '[data-style-padding-all]', '8')
  await commitStyleInput(page, '[data-style-radius]', '4')
  await page.locator('[data-style-shadow]').selectOption('sm')
  const leftMenu = frame(page, 'left-menu').locator('.wf-window-shell')
  await expectOnlyBorder(page, leftMenu, 'right')
  await checkpoint(page, info, '13-left-menu-styles')

  await page.locator('[data-workspace-edit-toggle]').click()
  await expect(frame(page, 'left-menu')).not.toHaveAttribute('data-layout-selection')
  await expect(page.locator('[data-dock-id="topnav"]')).not.toHaveAttribute('data-layout-selection')
  await leftMenu.click()
  await expect(frame(page, 'left-menu')).not.toHaveAttribute('data-layout-selection')
  await expectOnlyBorder(page, leftMenu, 'right')
  await checkpoint(page, info, '14-final-styled-normal')
})

test('keeps Pane and Dock styles scoped to their host surfaces', async ({ page }, info) => {
  await loadFixture(page)
  await enterEditMode(page)

  await selectPane(page, 'topnav-pane')
  await openStyles(page)
  await page.locator('[data-style-background-mode]').selectOption('custom')
  await commitStyleInput(page, '[data-style-background-color]', '#263b4a')
  await setBorderState(page, 'top', false)
  await setBorderState(page, 'right', false)
  await setBorderState(page, 'bottom', false)
  await setBorderState(page, 'left', true)
  await page.locator('[data-style-border-target]').selectOption('left')
  await commitStyleInput(page, '[data-style-border-width]', '2')
  await commitStyleInput(page, '[data-style-padding-all]', '4')
  const pane = page.locator('[data-pane-id="topnav-pane"]')
  await expect(pane).toHaveAttribute('style', /--wf-surface-background: #263b4a/)
  await expect(pane).toHaveAttribute('style', /--wf-surface-border-left-width: 2px/)
  await expect(pane).toHaveAttribute('style', /--wf-surface-padding-top: 4px/)
  await checkpoint(page, info, '15-pane-styles')

  await selectDock(page, 'topnav')
  await openStyles(page)
  await expect(page.locator('[data-dock-id="topnav"]')).not.toHaveAttribute('style', /#263b4a/)
  await expect(page.locator('[data-dock-id="topnav"] [data-pane-id="topnav-pane"]')).toHaveAttribute('data-surface-style', 'true')
  const beforeThickness = await page.locator('[data-dock-id="topnav"]').boundingBox()
  await page.locator('[data-style-background-mode]').selectOption('transparent')
  const afterThickness = await page.locator('[data-dock-id="topnav"]').boundingBox()
  if (!beforeThickness || !afterThickness) throw new Error('Dock geometry was not measurable')
  expect(afterThickness.height).toBe(beforeThickness.height)
  await checkpoint(page, info, '16-dock-styles')
})

test('keeps Window constraints and SurfaceStyles independent through resize and reload', async ({ page }, info) => {
  await loadFixture(page)
  await enterEditMode(page)
  await selectWindow(page, 'center-window')
  await createConstraintByKeyboard(page, 'right', /Right Menu .* left/, 'right-menu')
  await setInspectorDistance(page, 'right', '20')
  await openStyles(page)
  await page.locator('[data-style-background-mode]').selectOption('custom')
  await commitStyleInput(page, '[data-style-background-color]', '#30485b')
  await setBorderState(page, 'bottom', true)
  await page.locator('[data-style-border-target]').selectOption('bottom')
  await commitStyleInput(page, '[data-style-border-width]', '2')
  await commitStyleInput(page, '[data-style-padding-all]', '5')
  const shell = frame(page, 'center-window').locator('.wf-window-shell')
  await expect(shell).toHaveAttribute('style', /--wf-surface-background: #30485b/)
  await expect(relation(page, 'right-menu')).toHaveCount(1)
  await checkpoint(page, info, '17-window-styles-and-constraint')

  await page.locator('[data-workspace-edit-toggle]').click()
  await page.waitForTimeout(50)
  await page.reload()
  await enterEditMode(page)
  await selectWindow(page, 'center-window')
  await expect(relation(page, 'right-menu')).toHaveCount(1)
  await expect(page.locator('[data-layout-inspector-tab="object"]')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[data-layout-constraint-offset="right"]')).toHaveValue('20')
  await openStyles(page)
  await expect(page.locator('[data-style-background-mode]')).toHaveValue('custom')
  await expect(page.locator('[data-style-background-color]')).toHaveValue('#30485b')
  await expect.poll(() => physicalGap(page, 'center-window', 'right-menu')).toBeCloseTo(20, 0)
  await page.setViewportSize({ width: 1024, height: 768 })
  await expect.poll(() => physicalGap(page, 'center-window', 'right-menu')).toBeCloseTo(20, 0)
})

test('records atomic border history, linked padding, reset, and redo without changing layout constraints', async ({ page }) => {
  await loadFixture(page)
  await enterEditMode(page)
  await selectWindow(page, 'left-menu')
  await openStyles(page)
  await setBorderState(page, 'bottom', true)
  await page.locator('[data-style-border-target]').selectOption('bottom')
  await commitStyleInput(page, '[data-style-border-width]', '2')
  await commitStyleInput(page, '[data-style-border-color]', '#d26b42')
  await commitStyleInput(page, '[data-style-padding-all]', '8')
  await page.locator('[data-style-padding-linked]').click()
  await commitStyleInput(page, '[data-style-padding-side="left"]', '12')
  await commitStyleInput(page, '[data-style-padding-side="right"]', '12')
  const shell = frame(page, 'left-menu').locator('.wf-window-shell')
  await expectOnlyBorder(page, shell, 'bottom', '2px')
  await expect(shell).toHaveAttribute('style', /--wf-surface-padding-top: 8px/)
  await expect(shell).toHaveAttribute('style', /--wf-surface-padding-left: 12px/)
  await expect(page.locator('[data-layout-acceptance-undo]')).toBeEnabled()

  for (let index = 0; index < 6; index += 1) await page.locator('[data-layout-acceptance-undo]').click()
  await expect(shell).not.toHaveAttribute('style', /--wf-surface-border-bottom-width: 2px/)
  await expect(page.locator('[data-layout-inspector]')).toBeVisible()
  await expect(relation(page, 'right-menu')).toHaveCount(0)
  for (let index = 0; index < 6; index += 1) await page.locator('[data-layout-acceptance-redo]').click()
  await expectOnlyBorder(page, shell, 'bottom', '2px')
  await expect(shell).toHaveAttribute('style', /--wf-surface-border-bottom-color: #d26b42/)

  await page.locator('[data-style-reset]').click()
  await expect(shell).not.toHaveAttribute('style', /--wf-surface-border-bottom-width: 2px/)
  await page.locator('[data-layout-acceptance-undo]').click()
  await expectOnlyBorder(page, shell, 'bottom', '2px')
})

test('covers keyboard Inspector controls and keeps editor chrome sharp while content is dimmed', async ({ page }, info) => {
  await loadFixture(page)
  await enterEditMode(page)
  await selectWindow(page, 'center-window')

  const content = page.locator('[data-window-instance-id="center-window"] [data-layout-content="dimmed"]')
  const contentState = await content.evaluate((element) => {
    const style = getComputedStyle(element)
    return { opacity: style.opacity, filter: style.filter }
  })
  expect(contentState.opacity).toBe('0.36')
  expect(contentState.filter).toContain('blur(1px)')
  expect(await page.locator('[data-layout-inspector]').evaluate((element) => getComputedStyle(element).filter)).toBe('none')
  expect(await page.locator('[data-workspace-edit-chrome]').evaluate((element) => getComputedStyle(element).filter)).toBe('none')
  await expect(page.locator('[data-layout-inspector] .wf-icon')).toHaveCount(7)
  await expect(page.locator('[data-window-constraint-handle] .wf-icon')).toHaveCount(4)

  const objectTab = page.locator('[data-layout-inspector-tab="object"]')
  await objectTab.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-layout-inspector-tab="styles"]')).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(objectTab).toHaveAttribute('aria-selected', 'true')
  await openStyles(page)
  const bottomBorder = page.locator('[data-style-border-side="bottom"]')
  await bottomBorder.focus()
  await page.keyboard.press('Enter')
  await expect(bottomBorder).toHaveAttribute('aria-pressed', 'true')
  await commitStyleInput(page, '[data-style-padding-all]', '8')

  const dockButton = page.locator('[data-layout-inspector-dock]')
  await dockButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-layout-inspector]')).toHaveAttribute('data-layout-inspector-mode', 'floating')
  const minimize = page.locator('[data-layout-inspector-minimize]')
  await minimize.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-layout-inspector]')).toHaveAttribute('data-layout-inspector-mode', 'minimized')
  await page.locator('[data-layout-inspector-restore]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-layout-inspector]')).toHaveAttribute('data-layout-inspector-mode', 'floating')
  await page.locator('[data-layout-inspector-dock]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-layout-inspector]')).toHaveAttribute('data-layout-inspector-mode', 'docked')
  await checkpoint(page, info, '18-keyboard-and-dimmed-editor')

  await page.locator('[data-workspace-edit-toggle]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-layout-inspector]')).toBeHidden()
  const normalState = await page.locator('[data-window-instance-id="center-window"] .wf-window-shell__content').evaluate((element) => {
    const style = getComputedStyle(element)
    return { opacity: style.opacity, filter: style.filter }
  })
  expect(normalState).toEqual({ opacity: '1', filter: 'none' })
})

test('curates the Light Theme acceptance checkpoint with the same accessible editor flow', async ({ page }, info) => {
  await page.addInitScript(() => window.localStorage.setItem('widgetforge.playground.theme', 'forge-light'))
  await loadFixture(page)
  await expect(page.locator('.wf-theme')).toHaveAttribute('style', /--wf-color-canvas: #e6edf2/)
  await enterEditMode(page)
  await selectDock(page, 'topnav')
  await openStyles(page)
  await expect(page.locator('[data-layout-inspector] .wf-icon')).toHaveCount(11)
  await checkpoint(page, info, '19-light-theme-styles')
})

test.describe('viewport matrix', () => {
  test.use({ viewport: { width: 720, height: 600 } })

  test('keeps the inspector reachable and the workspace horizontally contained at a narrow viewport', async ({ page }, info) => {
    await loadFixture(page)
    await enterEditMode(page)
    await expect(page.locator('[data-layout-inspector-empty]')).toBeVisible()
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 720)
    await selectWindow(page, 'center-window')
    await page.locator('[data-layout-inspector-toggle]').click()
    await expect(page.locator('[data-layout-inspector]')).toHaveClass(/wf-layout-inspector--collapsed/)
    await checkpoint(page, info, '09-narrow-inspector')
    await expect(page.getByRole('button', { name: 'Exit layout edit mode' })).toBeVisible()
    await expect(page.locator('[data-layout-acceptance-toolbar]')).toBeVisible()
  })
})
