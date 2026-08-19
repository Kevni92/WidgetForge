import { defineComponent, h, onMounted } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createWidgetPane } from '../src/core/pane'
import { defineWidget, WidgetDefinitionError } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import PaneHost from '../src/vue/PaneHost.vue'
import WindowShell from '../src/vue/WindowShell.vue'
import { provideWidgetActionExecutor } from '../src/vue/widget-action-execution'
import { useWidgetContext } from '../src/vue/widget-context'
import { provideWidgetNavigation } from '../src/vue/widget-navigation'

function staticWidget(component = defineComponent({ template: '<div>static</div>' })) {
  return defineWidget({
    id: 'test.actions', title: 'Action Widget', component,
    actions: [
      { id: 'refresh', label: 'Refresh', icon: 'R', shortcut: 'Ctrl+R', group: 'data', priority: 20, target: { kind: 'callback', ref: 'refresh' } },
      { id: 'details', label: 'Details', icon: 'D', group: 'navigation', priority: 10, target: { kind: 'navigation', intent: { widgetId: 'test.target' } } },
      { id: 'command', label: 'Command', icon: 'C', group: 'tools', target: { kind: 'command', command: 'open-panel' } },
      { id: 'fourth', label: 'Fourth', icon: '4', target: { kind: 'callback', ref: 'fourth' } },
    ],
  })
}
const Target = defineComponent({ template: '<div>target</div>' })
const targetWidget = defineWidget({ id: 'test.target', title: 'Target', component: Target })

function mountWithExecutors(component: ReturnType<typeof defineComponent>, callback = vi.fn(), command = vi.fn(), navigate = vi.fn(() => ({ widgetId: 'test.target', instanceId: 'target-1' }))) {
  const Root = defineComponent({
    setup() {
      provideWidgetNavigation({ navigate })
      provideWidgetActionExecutor({ executeCallback: callback, executeCommand: command })
      return () => h(component)
    },
  })
  return { wrapper: mount(Root), callback, command, navigate }
}

describe('widget actions', () => {
  it('validates action ids, required labels/icons and duplicates through defineWidget', () => {
    const Component = defineComponent({ template: '<div />' })
    expect(() => defineWidget({ id: 'test.invalid-action', title: 'Invalid', component: Component, actions: [{ id: 'Bad ID', label: 'Bad', icon: 'B' }] })).toThrowError(WidgetDefinitionError)
    expect(() => defineWidget({ id: 'test.duplicate-action', title: 'Duplicate', component: Component, actions: [{ id: 'same', label: 'One', icon: '1' }, { id: 'same', label: 'Two', icon: '2' }] })).toThrowError(/duplicate widget action id/)
    expect(staticWidget().actions?.map((action) => action.id)).toEqual(['refresh', 'details', 'command', 'fourth'])
  })

  it('updates visible/disabled action state reactively without remounting the widget', async () => {
    const mounted = vi.fn(), followed = vi.fn()
    const Probe = defineComponent({
      setup() {
        const context = useWidgetContext()
        context.actions.register({ id: 'follow', label: 'Follow', icon: 'F', disabled: true, visible: true, tone: 'accent', group: 'tracking' }, followed)
        onMounted(mounted)
        return () => h('button', { class: 'enable-follow', onClick: () => context.actions.setState('follow', { disabled: false, label: 'Following' }) }, 'enable')
      },
    })
    const widget = defineWidget({ id: 'test.dynamic-actions', title: 'Dynamic', component: Probe })
    const registry = createWidgetRegistry([widget])
    const Shell = defineComponent({ setup: () => () => h(WindowShell, { registry, widgetId: widget.id, instanceId: 'dynamic-1' }) })
    const { wrapper } = mountWithExecutors(Shell)
    await wrapper.vm.$nextTick()
    const initial = wrapper.get('[data-widget-action="follow"]')
    expect(initial.attributes('disabled')).toBeDefined()
    expect(mounted).toHaveBeenCalledTimes(1)

    await wrapper.get('.enable-follow').trigger('click')
    await wrapper.vm.$nextTick()
    const updated = wrapper.get('[data-widget-action="follow"]')
    expect(updated.attributes('disabled')).toBeUndefined()
    expect(updated.attributes('aria-label')).toBe('Following')
    expect(mounted).toHaveBeenCalledTimes(1)
    await updated.trigger('click')
    expect(followed).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('renders the same declarative actions in window and pane chrome with grouping and overflow', async () => {
    const widget = staticWidget(), registry = createWidgetRegistry([widget, targetWidget]), pane = createWidgetPane({ id: 'action-pane', widgetId: widget.id, instanceId: 'action-instance' })
    const Pane = defineComponent({ setup: () => () => h(PaneHost, { pane, registry }) })
    const paneMounted = mountWithExecutors(Pane)
    await paneMounted.wrapper.vm.$nextTick()
    expect(paneMounted.wrapper.get('.wf-pane-host__actionbar [data-widget-action="refresh"]').attributes('data-action-group')).toBe('data')
    expect(paneMounted.wrapper.find('[aria-label="More widget actions"]').exists()).toBe(true)
    paneMounted.wrapper.unmount()

    const Window = defineComponent({ setup: () => () => h(WindowShell, { pane, registry, instanceId: 'window-1' }) })
    const windowMounted = mountWithExecutors(Window)
    await windowMounted.wrapper.vm.$nextTick()
    expect(windowMounted.wrapper.get('.wf-window-shell__titlebar [data-widget-action="refresh"]').attributes('title')).toContain('Ctrl+R')
    expect(windowMounted.wrapper.find('.wf-window-shell__content .wf-pane-host__actionbar').exists()).toBe(false)
    expect(windowMounted.wrapper.find('[aria-label="More widget actions"]').exists()).toBe(true)
    windowMounted.wrapper.unmount()
  })

  it('executes callback, command and navigation targets and supports keyboard activation', async () => {
    const widget = staticWidget(), registry = createWidgetRegistry([widget, targetWidget]), pane = createWidgetPane({ id: 'target-pane', widgetId: widget.id, instanceId: 'target-instance' })
    const Pane = defineComponent({ setup: () => () => h(PaneHost, { pane, registry }) })
    const { wrapper, callback, command, navigate } = mountWithExecutors(Pane)
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-widget-action="refresh"]').trigger('keydown', { key: 'Enter' })
    expect(callback).toHaveBeenCalledWith('refresh', expect.objectContaining({ instanceId: 'target-instance', widgetId: 'test.actions' }))
    await wrapper.get('[data-widget-action="details"]').trigger('click')
    expect(navigate).toHaveBeenCalledWith({ widgetId: 'test.target' })
    await wrapper.get('[data-widget-action="command"]').trigger('click')
    expect(command).toHaveBeenCalledWith('open-panel', expect.objectContaining({ instanceId: 'target-instance' }))
    wrapper.unmount()
  })
})
