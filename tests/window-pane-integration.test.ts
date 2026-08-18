import { defineComponent, h, nextTick, onMounted, onUnmounted } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createSplitPane, createWidgetPane } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import WindowManagerHost from '../src/vue/WindowManagerHost.vue'

describe('pane-based windows', () => {
  it('renders multiple leaves and does not remount them on window or pane layout changes', async () => {
    let mounts = 0
    let unmounts = 0
    const Probe = defineComponent({
      setup() {
        onMounted(() => { mounts += 1 })
        onUnmounted(() => { unmounts += 1 })
        return () => h('span', { class: 'pane-window-probe' }, 'probe')
      },
    })
    const registry = createWidgetRegistry([
      defineWidget({ id: 'test.window-pane', title: 'Pane Widget', component: Probe }),
    ])
    const manager = createWindowManager(registry)
    const root = createSplitPane({
      id: 'root',
      axis: 'horizontal',
      children: [
        createWidgetPane({ id: 'left', widgetId: 'test.window-pane', instanceId: 'left-widget' }),
        createWidgetPane({ id: 'right', widgetId: 'test.window-pane', instanceId: 'right-widget' }),
      ],
    })
    manager.openPane({ pane: root, instanceId: 'pane-window', title: 'Composite' })

    const wrapper = mount(WindowManagerHost, { props: { manager, registry } })
    expect(wrapper.findAll('.pane-window-probe')).toHaveLength(2)
    expect(mounts).toBe(2)

    manager.setGeometry('pane-window', { position: { x: 40, y: 50 }, size: { width: 500, height: 320 } })
    manager.setRootPane('pane-window', { ...root, weights: [2, 1] })
    await nextTick()

    expect(wrapper.findAll('.pane-window-probe')).toHaveLength(2)
    expect(mounts).toBe(2)

    manager.close('pane-window')
    await nextTick()
    expect(wrapper.findAll('.pane-window-probe')).toHaveLength(0)
    expect(unmounts).toBe(2)
    wrapper.unmount()
  })
})
