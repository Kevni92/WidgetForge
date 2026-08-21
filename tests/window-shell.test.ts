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
    expect(wrapper.get('.wf-window-shell__minimize .wf-icon').attributes('aria-hidden')).toBe('true')
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

  it('offers a generic edit-mode lock action and renders locked content chrome-less', async () => {
    const registry = createWidgetRegistry()
    const wrapper = mount(WindowShell, {
      props: { registry, widgetId: 'locked.widget', instanceId: 'locked-window', title: 'Locked', editMode: true },
      slots: { default: () => h('button', { class: 'interactive-content' }, 'Interactive') },
    })

    expect(wrapper.get('[data-window-lock]').attributes('aria-label')).toBe('Lock window')
    await wrapper.get('[data-window-lock]').trigger('click')
    expect(wrapper.emitted('lock')?.[0]?.[0]).toEqual({ instanceId: 'locked-window' })

    await wrapper.setProps({ windowLocked: true })
    expect(wrapper.get('.wf-window-shell').attributes('data-window-locked')).toBe('true')
    expect(wrapper.find('.wf-window-shell__titlebar').exists()).toBe(false)
    expect(wrapper.find('[data-window-lock]').exists()).toBe(false)
    expect(wrapper.get('.interactive-content').text()).toBe('Interactive')
    expect(wrapper.get('.wf-window-shell__content').classes()).toContain('wf-window-shell__content')
  })

  it('keeps the focused state for behavior but suppresses the floating focus border while locked', async () => {
    const registry = createWidgetRegistry()
    const wrapper = mount(WindowShell, {
      props: { registry, widgetId: 'focus.widget', instanceId: 'focus-window', title: 'Focus', focused: true },
      slots: { default: () => h('button', { class: 'focusable-content' }, 'Content') },
    })

    expect(wrapper.get('.wf-window-shell').classes()).toContain('wf-window-shell--focused')
    expect(wrapper.get('.wf-window-shell').attributes('data-window-visual-focused')).toBe('true')
    expect(wrapper.get('.wf-window-shell').attributes('data-focused')).toBe('true')

    await wrapper.setProps({ windowLocked: true })
    expect(wrapper.get('.wf-window-shell').classes()).not.toContain('wf-window-shell--focused')
    expect(wrapper.get('.wf-window-shell').attributes('data-window-visual-focused')).toBe('false')
    expect(wrapper.get('.wf-window-shell').attributes('data-focused')).toBe('true')

    await wrapper.setProps({ focused: false })
    expect(wrapper.get('.wf-window-shell').attributes('data-window-visual-focused')).toBe('false')
    wrapper.unmount()
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

  it('keeps the outer border and shadow separate from the shared clipped surface', () => {
    const registry = createWidgetRegistry()
    const wrapper = mount(WindowShell, {
      props: { registry, widgetId: 'clipping.widget', instanceId: 'clipping-window', title: 'Clipping' },
      slots: { default: () => h('div', { class: 'corner-sensitive-content' }, 'Content') },
    })

    const shell = wrapper.get('.wf-window-shell')
    const surface = wrapper.get('.wf-window-shell__surface')

    expect(surface.element.parentElement).toBe(shell.element)
    expect(surface.find('.wf-window-shell__titlebar').exists()).toBe(true)
    expect(surface.find('.wf-window-shell__content .corner-sensitive-content').exists()).toBe(true)
    expect(shell.classes()).toContain('wf-window-shell--chrome-default')
    expect(shell.classes()).not.toContain('wf-window-shell--chrome-none')
  })

  it('does not expose the removed window-to-dock action and keeps regular actions', async () => {
    const registry = createWidgetRegistry()
    const wrapper = mount(WindowShell, {
      props: { registry, widgetId: 'window-actions.widget', instanceId: 'window-actions', title: 'Window actions', minimizable: true, closable: true },
    })

    expect(wrapper.find('[aria-label="Anchor window to workspace"]').exists()).toBe(false)
    expect(wrapper.find('.wf-window-shell__dock').exists()).toBe(false)
    expect(wrapper.find('[data-window-dock-position]').exists()).toBe(false)
    await wrapper.get('.wf-window-shell__minimize').trigger('click')
    expect(wrapper.emitted('minimize')?.[0]?.[0]).toEqual({ instanceId: 'window-actions' })
    await wrapper.get('.wf-window-shell__close').trigger('click')
    expect(wrapper.emitted('close')?.[0]?.[0]).toEqual({ instanceId: 'window-actions' })
  })
})
