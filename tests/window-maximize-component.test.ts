import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import WindowFrame from '../src/vue/WindowFrame.vue'

const Widget = defineComponent({ template: '<span>layout</span>' })

describe('window chrome layout actions', () => {
  it('removes the default snap/layout action while keeping the remaining titlebar controls', () => {
    const registry = createWidgetRegistry([defineWidget({ id: 'layout.widget', title: 'Layout', component: Widget })])
    const manager = createWindowManager(registry)
    const state = manager.open({ widgetId: 'layout.widget', instanceId: 'layout' })
    const wrapper = mount(WindowFrame, { props: { window: state, manager, registry, containerSize: { width: 900, height: 600 } } })

    expect(wrapper.find('.wf-window-shell__maximize').exists()).toBe(false)
    expect(wrapper.find('.wf-window-shell__layout-action').exists()).toBe(false)
    expect(wrapper.find('[data-window-snap-layout-picker]').exists()).toBe(false)
    expect(wrapper.findAll('.wf-window-shell__actions > button').map((button) => button.attributes('aria-label'))).toEqual(['Minimize window', 'Close window'])
    wrapper.unmount()
  })

  it('keeps snap, maximize and restore state operations independent from titlebar chrome', () => {
    const registry = createWidgetRegistry([defineWidget({ id: 'layout.widget', title: 'Layout', component: Widget })])
    const manager = createWindowManager(registry)
    manager.open({ widgetId: 'layout.widget', instanceId: 'layout', position: { x: 90, y: 70 }, size: { width: 360, height: 240 } })

    manager.maximizeWindow('layout', { width: 900, height: 600 })
    expect(manager.get('layout')).toMatchObject({ mode: 'maximized', geometry: { position: { x: 0, y: 0 }, size: { width: 900, height: 600 } }, restoreGeometry: { position: { x: 90, y: 70 }, size: { width: 360, height: 240 } } })
    manager.restore('layout')
    expect(manager.get('layout').geometry).toEqual({ position: { x: 90, y: 70 }, size: { width: 360, height: 240 } })

    manager.snapWindow('layout', 'right-two-thirds', { width: 900, height: 600 })
    expect(manager.get('layout')).toMatchObject({ mode: 'normal', snap: { zone: 'right-two-thirds' }, geometry: { position: { x: 300, y: 0 }, size: { width: 600, height: 600 } } })
  })
})
