import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { useWidgetNavigation, WidgetNavigationUnavailableError } from '../src/vue/widget-navigation'
import WindowManagerHost from '../src/vue/WindowManagerHost.vue'

const TargetWidget = defineComponent({ template: '<span class="target">target</span>' })
const CallerWidget = defineComponent({
  setup() {
    const navigation = useWidgetNavigation()
    return () => h('button', {
      class: 'navigate',
      onClick: () => navigation.navigate({ widgetId: 'test.target', parameters: { id: 'B-2' } }),
    }, 'navigate')
  },
})

describe('Vue widget navigation', () => {
  it('lets a widget navigate without exposing WindowManager internals', async () => {
    const registry = createWidgetRegistry([
      defineWidget({ id: 'test.caller', title: 'Caller', component: CallerWidget }),
      defineWidget({
        id: 'test.target',
        title: 'Target',
        component: TargetWidget,
        parameters: { id: { type: 'string', required: true } },
      }),
    ])
    const manager = createWindowManager(registry)
    manager.open({ widgetId: 'test.caller', instanceId: 'caller' })

    const wrapper = mount(WindowManagerHost, { props: { manager, registry } })
    await wrapper.get('.navigate').trigger('click')

    const target = manager.list().find((window) =>
      window.rootPane.kind === 'widget' && window.rootPane.widgetId === 'test.target')
    expect(target?.rootPane.kind).toBe('widget')
    if (target?.rootPane.kind === 'widget') expect(target.rootPane.parameters).toEqual({ id: 'B-2' })
    expect(wrapper.find('.target').exists()).toBe(true)
    wrapper.unmount()
  })

  it('fails explicitly when navigation is used outside a navigation provider', () => {
    const Probe = defineComponent({
      setup() {
        useWidgetNavigation()
        return () => null
      },
    })

    expect(() => mount(Probe)).toThrow(WidgetNavigationUnavailableError)
  })
})
