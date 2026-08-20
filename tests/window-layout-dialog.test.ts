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

    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual({ layoutSpec: null, geometry: { position: { x: 80, y: 220 }, size: { width: 400, height: 160 } } })
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

    await wrapper.get('[data-layout-horizontal-end]').setValue('workspace:left')
    await wrapper.get('[data-layout-save]').trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.get('[role="alert"]').text()).toContain('cannot combine')
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
