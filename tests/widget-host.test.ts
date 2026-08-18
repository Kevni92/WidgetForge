import { defineComponent, h, onMounted, onUnmounted } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WidgetHost from '../src/vue/WidgetHost.vue'
import { useWidgetContext } from '../src/vue/widget-context'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'

describe('WidgetHost', () => {
  it('renders a registered widget with a small reactive context without remounting on parameter updates', async () => {
    let mounts = 0
    let unmounts = 0

    const Probe = defineComponent({
      setup() {
        const context = useWidgetContext<{ label: string }>()
        onMounted(() => { mounts += 1 })
        onUnmounted(() => { unmounts += 1 })
        return () => h('span', { class: 'probe' }, `${context.instanceId}:${context.parameters.value.label}`)
      },
    })

    const registry = createWidgetRegistry([
      defineWidget({
        id: 'test.probe',
        title: 'Probe',
        component: Probe,
        parameters: { label: { type: 'string', required: true } },
      }),
    ])

    const wrapper = mount(WidgetHost, {
      props: {
        registry,
        widgetId: 'test.probe',
        instanceId: 'probe-1',
        parameters: { label: 'alpha' },
      },
    })

    expect(wrapper.get('.probe').text()).toBe('probe-1:alpha')
    expect(mounts).toBe(1)

    await wrapper.setProps({ parameters: { label: 'beta' } })

    expect(wrapper.get('.probe').text()).toBe('probe-1:beta')
    expect(mounts).toBe(1)

    wrapper.unmount()
    expect(unmounts).toBe(1)
  })

  it('keeps multiple instances isolated', () => {
    const Probe = defineComponent({
      setup() {
        const context = useWidgetContext<{ value: string }>()
        return () => h('span', { class: 'probe' }, `${context.instanceId}:${context.parameters.value.value}`)
      },
    })

    const registry = createWidgetRegistry([
      defineWidget({
        id: 'test.isolated',
        title: 'Isolated',
        component: Probe,
        parameters: { value: { type: 'string', required: true } },
      }),
    ])

    const first = mount(WidgetHost, {
      props: { registry, widgetId: 'test.isolated', instanceId: 'first', parameters: { value: 'A' } },
    })
    const second = mount(WidgetHost, {
      props: { registry, widgetId: 'test.isolated', instanceId: 'second', parameters: { value: 'B' } },
    })

    expect(first.get('.probe').text()).toBe('first:A')
    expect(second.get('.probe').text()).toBe('second:B')
  })

  it('renders a defined error state for unknown widgets and invalid parameters', async () => {
    const Probe = defineComponent(() => () => h('span', 'ok'))
    const registry = createWidgetRegistry([
      defineWidget({
        id: 'test.validation',
        title: 'Validation',
        component: Probe,
        parameters: { id: { type: 'string', required: true } },
      }),
    ])

    const wrapper = mount(WidgetHost, {
      props: { registry, widgetId: 'missing.widget', instanceId: 'error-1' },
    })

    expect(wrapper.get('[role="alert"]').text()).toContain('unknown widget')

    await wrapper.setProps({ widgetId: 'test.validation', parameters: {} })
    expect(wrapper.get('[role="alert"]').text()).toContain('invalid parameters')
  })
})
