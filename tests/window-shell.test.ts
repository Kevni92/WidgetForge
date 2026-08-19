import { defineComponent, h, onMounted } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WindowShell from '../src/vue/WindowShell.vue'
import { useWidgetContext } from '../src/vue/widget-context'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'

describe('WindowShell', () => {
  it('renders manifest title and widget content without remounting on shell-state changes', async () => {
    let mounts = 0
    const Probe = defineComponent({
      setup() {
        onMounted(() => { mounts += 1 })
        const context = useWidgetContext<{ label: string }>()
        return () => h('span', { class: 'probe' }, context.parameters.value.label)
      },
    })
    const registry = createWidgetRegistry([
      defineWidget({
        id: 'test.window',
        title: 'Test Window',
        component: Probe,
        parameters: { label: { type: 'string', required: true } },
      }),
    ])

    const wrapper = mount(WindowShell, {
      props: {
        registry,
        widgetId: 'test.window',
        instanceId: 'window-1',
        parameters: { label: 'content' },
        focused: false,
      },
    })

    expect(wrapper.get('.wf-window-shell__title').text()).toBe('Test Window')
    expect(wrapper.get('.probe').text()).toBe('content')
    expect(mounts).toBe(1)

    await wrapper.setProps({ focused: true })

    expect(wrapper.get('.wf-window-shell').attributes('data-focused')).toBe('true')
    expect(wrapper.get('.wf-window-shell__minimize .wf-window-shell__action-icon').text()).toBe('−')
    expect(wrapper.get('.wf-window-shell__minimize').attributes('aria-label')).toBe('Minimize window')
    expect(wrapper.get('.wf-window-shell__close').attributes('aria-label')).toBe('Close window')
    expect(mounts).toBe(1)
  })

  it('emits focus and close intents with the correct instance id', async () => {
    const registry = createWidgetRegistry()
    const wrapper = mount(WindowShell, {
      props: {
        registry,
        widgetId: 'missing.widget',
        instanceId: 'window-events',
        title: 'Events',
      },
      slots: { default: () => h('span', 'content') },
    })

    await wrapper.get('.wf-window-shell').trigger('pointerdown')
    expect(wrapper.emitted('focus')?.[0]?.[0]).toEqual({ instanceId: 'window-events' })

    await wrapper.get('.wf-window-shell__close').trigger('click')
    expect(wrapper.emitted('close')?.[0]?.[0]).toEqual({ instanceId: 'window-events' })
  })

  it('keeps title and content independently replaceable and multiple shells isolated', async () => {
    const registry = createWidgetRegistry()
    const first = mount(WindowShell, {
      props: { registry, widgetId: 'unused.first', instanceId: 'first', title: 'First' },
      slots: {
        title: () => h('strong', { class: 'custom-title' }, 'Custom First'),
        default: () => h('div', { class: 'custom-content' }, 'First Content'),
      },
    })
    const second = mount(WindowShell, {
      props: { registry, widgetId: 'unused.second', instanceId: 'second', title: 'Second' },
      slots: { default: () => h('div', { class: 'custom-content' }, 'Second Content') },
    })

    expect(first.get('.custom-title').text()).toBe('Custom First')
    expect(first.get('.custom-content').text()).toBe('First Content')
    expect(second.get('.custom-content').text()).toBe('Second Content')

    await first.get('.wf-window-shell').trigger('pointerdown')
    expect(first.emitted('focus')).toHaveLength(1)
    expect(second.emitted('focus')).toBeUndefined()
  })

  it('keeps semantic window role classes available for surface/elevation styling', () => {
    const registry = createWidgetRegistry()
    const roles = ['normal', 'utility', 'overlay', 'modal'] as const

    for (const role of roles) {
      const wrapper = mount(WindowShell, {
        props: { registry, widgetId: `unused.${role}`, instanceId: `role-${role}`, title: role, windowRole: role },
      })

      expect(wrapper.get('.wf-window-shell').classes()).toContain(`wf-window-shell--role-${role}`)
      expect(wrapper.get('.wf-window-shell').attributes('data-window-role')).toBe(role)
      wrapper.unmount()
    }
  })
})
