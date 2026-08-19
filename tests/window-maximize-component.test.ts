import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import WindowFrame from '../src/vue/WindowFrame.vue'

const Widget = defineComponent({ template: '<span>layout</span>' })

describe('window layout picker integration', () => {
  it('maximizes and restores through generic window chrome', async () => {
    const registry = createWidgetRegistry([defineWidget({ id: 'layout.widget', title: 'Layout', component: Widget })])
    const manager = createWindowManager(registry)
    const state = manager.open({ widgetId: 'layout.widget', instanceId: 'layout', position: { x: 90, y: 70 }, size: { width: 360, height: 240 } })
    const wrapper = mount(WindowFrame, { props: { window: state, manager, registry, containerSize: { width: 800, height: 500 } }, attachTo: document.body })

    await wrapper.get('.wf-window-shell__maximize').trigger('click')
    await wrapper.get('[data-window-layout="maximize"]').trigger('click')
    await nextTick()
    expect(manager.get('layout')).toMatchObject({ mode: 'maximized', geometry: { position: { x: 0, y: 0 }, size: { width: 800, height: 500 } }, restoreGeometry: { position: { x: 90, y: 70 }, size: { width: 360, height: 240 } } })

    manager.restore('layout')
    expect(manager.get('layout').geometry).toEqual({ position: { x: 90, y: 70 }, size: { width: 360, height: 240 } })
    wrapper.unmount()
  })

  it('selects an advanced snap layout through the picker', async () => {
    const registry = createWidgetRegistry([defineWidget({ id: 'layout.widget', title: 'Layout', component: Widget })])
    const manager = createWindowManager(registry)
    const state = manager.open({ widgetId: 'layout.widget', instanceId: 'layout' })
    const wrapper = mount(WindowFrame, { props: { window: state, manager, registry, containerSize: { width: 900, height: 600 } }, attachTo: document.body })
    await wrapper.get('.wf-window-shell__maximize').trigger('click')
    await wrapper.get('[data-window-layout="right-two-thirds"]').trigger('click')
    expect(manager.get('layout')).toMatchObject({ mode: 'normal', snap: { zone: 'right-two-thirds' }, geometry: { position: { x: 300, y: 0 }, size: { width: 600, height: 600 } } })
    wrapper.unmount()
  })
})
