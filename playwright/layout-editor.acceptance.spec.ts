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
  await expect(relation(page, targetId)).toHaveCount(1)
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
