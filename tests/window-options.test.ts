import { defineComponent, h, nextTick, onMounted } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { createWindowOptions, WindowOptionsError } from '../src/core/window-options'
import WindowManagerHost from '../src/vue/WindowManagerHost.vue'

const Probe = defineComponent({ template: '<span class="window-option-probe">probe</span>' })

function registry() {
  return createWidgetRegistry([
    defineWidget({ id: 'test.normal', title: 'Normal', component: Probe }),
    defineWidget({ id: 'test.top', title: 'Top', component: Probe, window: { options: { layer: 'always-on-top' } } }),
  ])
}

describe('window options', () => {
  it('validates opacity and defaults', () => {
    expect(createWindowOptions()).toMatchObject({ layer: 'normal', opacity: 1, header: 'always', movable: true })
    expect(() => createWindowOptions({ opacity: 1.2 })).toThrow(WindowOptionsError)
  })

  it('persists typed surface styles, clones them at the manager boundary and renders their CSS variables', () => {
    const manager = createWindowManager(registry())
    const sourceStyle = { background: { mode: 'custom' as const, color: '#101820' }, border: { top: { enabled: true, width: 2 } }, padding: { left: 10 }, opacity: 0.68, shadow: 'sm' as const }
    manager.open({ widgetId: 'test.normal', instanceId: 'styled', options: { surfaceStyle: sourceStyle } })
    const opened = manager.get('styled')
    expect(opened.options.opacity).toBe(0.68)
    expect(opened.options.surfaceStyle).toEqual(sourceStyle)
    expect(opened.options.surfaceStyle).not.toBe(sourceStyle)
    const wrapper = mount(WindowManagerHost, { props: { manager, registry: registry() } })
    expect(wrapper.get('.wf-window-shell').attributes('style')).toContain('--wf-surface-background')
    expect(wrapper.get('.wf-window-shell').attributes('style')).toContain('--wf-surface-border-top-width: 2px')
    manager.setOptions('styled', { surfaceStyle: { background: { mode: 'transparent' } } })
    expect(manager.get('styled').options.surfaceStyle).toEqual({ background: { mode: 'transparent' } })
    wrapper.unmount()
  })

  it('keeps always-on-top windows above normal windows even when a normal window receives focus', () => {
    const manager = createWindowManager(registry())
    const normalA = manager.open({ widgetId: 'test.normal', instanceId: 'normal-a' })
    const top = manager.open({ widgetId: 'test.top', instanceId: 'top' })
    const normalB = manager.open({ widgetId: 'test.normal', instanceId: 'normal-b' })

    expect(manager.list().map((window) => window.instanceId)).toEqual([normalA.instanceId, normalB.instanceId, top.instanceId])
    expect(manager.get(normalB.instanceId).focused).toBe(true)
    manager.focus(normalA.instanceId)
    expect(manager.list().map((window) => window.instanceId)).toEqual([normalB.instanceId, normalA.instanceId, top.instanceId])
    expect(manager.get(normalA.instanceId).focused).toBe(true)
    expect(manager.get(top.instanceId).zIndex).toBeGreaterThan(manager.get(normalA.instanceId).zIndex)
  })

  it('updates layer and presentation without remounting widget content', async () => {
    let mounts = 0
    const MountedProbe = defineComponent({
      setup() { onMounted(() => { mounts += 1 }); return () => h('span', { class: 'mounted-probe' }, 'mounted') },
    })
    const localRegistry = createWidgetRegistry([defineWidget({ id: 'test.mounted', title: 'Mounted', component: MountedProbe })])
    const manager = createWindowManager(localRegistry)
    manager.open({ widgetId: 'test.mounted', instanceId: 'mounted' })
    const wrapper = mount(WindowManagerHost, { props: { manager, registry: localRegistry } })
    expect(mounts).toBe(1)

    manager.setOptions('mounted', { layer: 'always-on-top', opacity: 0.72, header: 'focused', resizable: false })
    await nextTick()
    expect(mounts).toBe(1)
    const frame = wrapper.get('[data-window-instance-id="mounted"]')
    expect(frame.attributes('data-window-layer')).toBe('always-on-top')
    expect(frame.attributes('style')).toContain('opacity: 0.72')
    expect(frame.findAll('[data-window-resize-handle]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('hides chrome and unavailable controls according to behavior settings', async () => {
    const manager = createWindowManager(registry())
    manager.open({ widgetId: 'test.normal', instanceId: 'configured', options: { closable: false, minimizable: false, header: 'focused' } })
    manager.open({ widgetId: 'test.normal', instanceId: 'other' })
    const wrapper = mount(WindowManagerHost, { props: { manager, registry: registry() } })

    const configured = wrapper.get('[data-window-instance-id="configured"]')
    expect(configured.find('.wf-window-shell__titlebar').exists()).toBe(false)
    manager.focus('configured')
    await nextTick()
    expect(configured.find('.wf-window-shell__titlebar').exists()).toBe(true)
    expect(configured.find('.wf-window-shell__close').exists()).toBe(false)
    expect(configured.find('.wf-window-shell__minimize').exists()).toBe(false)
    wrapper.unmount()
  })
})
