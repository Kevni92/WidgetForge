import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WindowLayoutDialog from '../src/vue/WindowLayoutDialog.vue'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'

const EmptyWidget = defineComponent({ template: '<div />' })

function setup() {
  const registry = createWidgetRegistry([
    defineWidget({ id: 'test.market', title: 'Market', component: EmptyWidget }),
    defineWidget({ id: 'test.map', title: 'Map', component: EmptyWidget }),
  ])
  const windows = createWindowManager(registry)
  const base = windows.open({ widgetId: 'test.market', instanceId: 'base', position: { x: 40, y: 30 }, size: { width: 220, height: 180 } })
  const selected = windows.open({ widgetId: 'test.map', instanceId: 'selected', position: { x: 300, y: 220 }, size: { width: 260, height: 160 } })
  return { windows, base, selected }
}

describe('WindowLayoutDialog', () => {
  it('edits absolute geometry with px and percent units and emits one save value', async () => {
    const { windows, selected } = setup()
    const wrapper = mount(WindowLayoutDialog, { attachTo: document.body, props: { open: true, window: selected, windows: windows.list(), container: { width: 800, height: 600 } } })
    await nextTick()

    expect(wrapper.get('[role="dialog"]').text()).toContain('selected')
    await wrapper.get('[data-layout-x]').setValue('10')
    await wrapper.findAll('select')[0]?.setValue('percent')
    await wrapper.get('[data-layout-width]').setValue('50')
    await wrapper.findAll('select')[2]?.setValue('percent')
    await wrapper.get('[data-layout-save]').trigger('click')

    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual({ layoutSpec: null, geometry: { position: { x: 10, y: 220 }, size: { width: 50, height: 160 } } })
    wrapper.unmount()
  })

  it('converts absolute units without changing the represented geometry', async () => {
    const { windows, selected } = setup()
    const wrapper = mount(WindowLayoutDialog, { attachTo: document.body, props: { open: true, window: selected, windows: windows.list(), container: { width: 800, height: 600 } } })
    await wrapper.get('[data-layout-width]').setValue('260')
    await wrapper.get('[aria-label="Width unit"]').setValue('percent')
    expect((wrapper.get('[data-layout-width]').element as HTMLInputElement).value).toBe('32.5')
    await wrapper.get('[data-layout-save]').trigger('click')
    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual({ layoutSpec: null, geometry: { position: { x: 300, y: 220 }, size: { width: 260, height: 160 } } })
    wrapper.unmount()
  })

  it('converts responsive offsets on the correct workspace axis', async () => {
    const { windows, selected } = setup()
    const wrapper = mount(WindowLayoutDialog, { attachTo: document.body, props: { open: true, window: selected, windows: windows.list(), container: { width: 800, height: 600 } } })
    await wrapper.find('input[type="radio"][value="responsive"]').setValue(true)
    await wrapper.get('[data-layout-left-offset]').setValue('200')
    await wrapper.get('[aria-label="Left offset unit"]').setValue('percent')
    expect((wrapper.get('[data-layout-left-offset]').element as HTMLInputElement).value).toBe('25')
    await wrapper.get('[data-layout-save]').trigger('click')
    const save = wrapper.emitted('save')?.[0]?.[0] as { geometry: { position: { x: number } }; layoutSpec: { horizontal: { start?: { offset?: { value: number; unit: string } } } } }
    expect(save.geometry.position.x).toBe(200)
    expect(save.layoutSpec.horizontal.start?.offset).toEqual({ value: 25, unit: 'percent' })
    wrapper.unmount()
  })

  it('initializes free geometry as a valid Left+Width and Top+Height draft', async () => {
    const { windows, selected } = setup()
    const wrapper = mount(WindowLayoutDialog, { attachTo: document.body, props: { open: true, window: selected, windows: windows.list(), container: { width: 800, height: 600 } } })
    await wrapper.find('input[type="radio"][value="responsive"]').setValue(true)
    expect(wrapper.get('[data-layout-horizontal-mode="start-size"]').element).toBeTruthy()
    expect((wrapper.get('[data-layout-left-target]').element as HTMLSelectElement).value).toBe('workspace:left')
    expect((wrapper.get('[data-layout-top-target]').element as HTMLSelectElement).value).toBe('workspace:top')
    expect((wrapper.get('[data-layout-width]').element as HTMLInputElement).value).toBe('260')
    expect((wrapper.get('[data-layout-height]').element as HTMLInputElement).value).toBe('160')
    await wrapper.get('[data-layout-save]').trigger('click')
    const save = wrapper.emitted('save')?.[0]?.[0] as { layoutSpec: { horizontal: { start?: unknown; end?: unknown }; vertical: { start?: unknown; end?: unknown } } }
    expect(save.layoutSpec.horizontal.start).toBeTruthy()
    expect(save.layoutSpec.horizontal.end).toBeUndefined()
    expect(save.layoutSpec.vertical.start).toBeTruthy()
    expect(save.layoutSpec.vertical.end).toBeUndefined()
    wrapper.unmount()
  })

  it('supports responsive window references and validates before save', async () => {
    const { windows, selected } = setup()
    const wrapper = mount(WindowLayoutDialog, { attachTo: document.body, props: { open: true, window: selected, windows: windows.list(), container: { width: 800, height: 600 } } })
    await wrapper.find('input[type="radio"][value="responsive"]').setValue(true)
    await wrapper.get('[data-layout-horizontal-start]').setValue('window:base:right')
    await wrapper.get('[data-layout-save]').trigger('click')
    const save = wrapper.emitted('save')?.[0]?.[0] as { layoutSpec: { horizontal: { start?: { target: { instanceId?: string } } } } }
    expect(save.layoutSpec.horizontal.start?.target.instanceId).toBe('base')

    expect(wrapper.find('[data-layout-horizontal-end]').exists()).toBe(false)
    await wrapper.get('[data-layout-horizontal-mode="stretch"]').trigger('change')
    await wrapper.get('[data-layout-horizontal-end]').setValue('workspace:right')
    await wrapper.get('[data-layout-save]').trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(2)
    expect((wrapper.emitted('save')?.[1]?.[0] as { layoutSpec: { horizontal: { size: string } } }).layoutSpec.horizontal.size).toBe('auto')
    wrapper.unmount()
  })

  it('uses directional labels, exclusive axis modes, grouped targets and canvas picking', async () => {
    const { windows, selected } = setup()
    const target = document.createElement('div')
    target.dataset.windowInstanceId = 'base'
    document.body.append(target)
    const wrapper = mount(WindowLayoutDialog, { attachTo: document.body, props: { open: true, window: selected, windows: windows.list(), container: { width: 800, height: 600 } } })
    await wrapper.find('input[type="radio"][value="responsive"]').setValue(true)
    expect(wrapper.text()).toContain('Left')
    expect(wrapper.text()).toContain('Right')
    expect(wrapper.find('[data-layout-left-target]').exists()).toBe(true)
    expect(wrapper.find('optgroup[label="Windows"]').exists()).toBe(true)

    await wrapper.get('[data-layout-pick="horizontal:left"]').trigger('click')
    expect(wrapper.get('[data-layout-picker-state]').text()).toContain('left')
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
    await nextTick()
    expect((wrapper.get('[data-layout-left-target]').element as HTMLSelectElement).value).toBe('window:base:right')

    await wrapper.get('[data-layout-horizontal-mode="stretch"]').trigger('change')
    expect(wrapper.find('[data-layout-horizontal-end]').exists()).toBe(true)
    expect(wrapper.get('[data-layout-calculated-width]').text()).toContain('calculated')
    expect(wrapper.find('[data-layout-horizontal-fill]').exists()).toBe(false)
    await wrapper.get('[data-layout-horizontal-mode="start-size"]').trigger('change')
    expect(wrapper.find('[data-layout-horizontal-end]').exists()).toBe(false)
    wrapper.unmount()
    target.remove()
  })

  it('supports a right-and-width footer mode without a competing left constraint', async () => {
    const { windows, selected } = setup()
    const wrapper = mount(WindowLayoutDialog, { attachTo: document.body, props: { open: true, window: selected, windows: windows.list(), container: { width: 800, height: 600 } } })
    await wrapper.find('input[type="radio"][value="responsive"]').setValue(true)
    await wrapper.get('[data-layout-horizontal-mode="end-size"]').trigger('change')
    await wrapper.get('[data-layout-horizontal-end]').setValue('workspace:right')
    await wrapper.get('[data-layout-vertical-mode="end-size"]').trigger('change')
    await wrapper.get('[data-layout-bottom-target]').setValue('workspace:bottom')
    await wrapper.get('[data-layout-height]').setValue('200')
    await wrapper.get('[data-layout-save]').trigger('click')

    const save = wrapper.emitted('save')?.[0]?.[0] as { layoutSpec: { horizontal: { start?: unknown; end?: { target: { edge: string } }; size?: { value: number } }; vertical: { start?: unknown; end?: { target: { edge: string } }; size?: { value: number } } } }
    expect(save.layoutSpec.horizontal.start).toBeUndefined()
    expect(save.layoutSpec.horizontal.end?.target.edge).toBe('right')
    expect(save.layoutSpec.horizontal.size?.value).toBe(260)
    expect(save.layoutSpec.vertical.start).toBeUndefined()
    expect(save.layoutSpec.vertical.end?.target.edge).toBe('bottom')
    expect(save.layoutSpec.vertical.size?.value).toBe(200)
    wrapper.unmount()
  })

  it('makes the retained-rule versus current-geometry choice explicit', async () => {
    const { windows, selected } = setup()
    const retainedWindow = {
      ...selected,
      layoutSpec: {
        horizontal: { start: { target: { kind: 'workspace' as const, edge: 'left' as const } }, size: { value: 50, unit: 'percent' as const } },
        vertical: { start: { target: { kind: 'workspace' as const, edge: 'top' as const } }, size: { value: 50, unit: 'percent' as const } },
      },
      layoutSpecState: 'dormant' as const,
    }
    const wrapper = mount(WindowLayoutDialog, { attachTo: document.body, props: { open: true, window: retainedWindow, windows: windows.list(), container: { width: 800, height: 600 } } })
    expect(wrapper.get('[data-layout-retained-choice]').text()).toContain('Responsive rule retained')
    expect((wrapper.get('[data-layout-width]').element as HTMLInputElement).value).toBe('50')
    await wrapper.get('[data-layout-start-current]').trigger('click')
    expect((wrapper.get('[data-layout-width]').element as HTMLInputElement).value).toBe('260')
    await wrapper.get('[data-layout-use-retained]').trigger('click')
    expect((wrapper.get('[data-layout-width]').element as HTMLInputElement).value).toBe('50')
    wrapper.unmount()
  })

  it('cancels with Escape and keeps focus inside the dialog while open', async () => {
    const { windows, selected } = setup()
    const wrapper = mount(WindowLayoutDialog, { attachTo: document.body, props: { open: true, window: selected, windows: windows.list(), container: { width: 800, height: 600 } } })
    await nextTick()
    const dialog = wrapper.get('[role="dialog"]')
    await dialog.trigger('keydown', { key: 'Tab' })
    expect(dialog.element.contains(document.activeElement)).toBe(true)
    await dialog.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    wrapper.unmount()
  })
})
