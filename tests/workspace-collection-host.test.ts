import { defineComponent, h, onMounted, onUnmounted } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createDataClient, createDataKey, type DataProvider } from '../src/data/data-client'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWorkspaceCollection } from '../src/core/workspace-collection'
import DataClientProvider from '../src/vue/DataClientProvider.vue'
import WorkspaceCollectionHost from '../src/vue/WorkspaceCollectionHost.vue'
import { useData } from '../src/vue/data-context'
import { useWidgetContext } from '../src/vue/widget-context'

describe('WorkspaceCollectionHost', () => {
  it('mounts only the active workspace and suspends workspace-specific data resources while inactive', async () => {
    const mounted: string[] = [], unmounted: string[] = [], unsubscribed: string[] = []
    const subscribe = vi.fn<DataProvider['subscribe']>((key, observer) => { observer.next(1); return () => { unsubscribed.push(key.id) } })
    const provider: DataProvider = { subscribe }
    const client = createDataClient(provider)
    const Probe = defineComponent({
      setup() {
        const context = useWidgetContext()
        const marker = () => String(context.parameters.value.marker)
        useData(createDataKey<number>('test', marker()))
        onMounted(() => mounted.push(marker()))
        onUnmounted(() => unmounted.push(marker()))
        return () => h('span', marker())
      },
    })
    const widgets = createWidgetRegistry([defineWidget({ id: 'test.probe', title: 'Probe', component: Probe, parameters: { marker: { type: 'string', required: true } } })])
    const collection = createWorkspaceCollection({ registry: widgets })
    const first = collection.createWorkspace({ id: 'first', name: 'First', activate: true })
    const second = collection.createWorkspace({ id: 'second', name: 'Second' })
    first.windows.open({ widgetId: 'test.probe', instanceId: 'first-widget', parameters: { marker: 'first' } })
    second.windows.open({ widgetId: 'test.probe', instanceId: 'second-widget', parameters: { marker: 'second' } })

    const Root = defineComponent({ setup: () => () => h(DataClientProvider, { client }, { default: () => h(WorkspaceCollectionHost, { manager: collection, registry: widgets }) }) })
    const wrapper = mount(Root)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('first')
    expect(wrapper.text()).not.toContain('second')
    expect(mounted).toEqual(['first'])
    expect(subscribe).toHaveBeenCalledTimes(1)

    collection.activateWorkspace('second')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('second')
    expect(wrapper.text()).not.toContain('first')
    expect(unmounted).toEqual(['first'])
    expect(mounted).toEqual(['first', 'second'])
    expect(subscribe).toHaveBeenCalledTimes(2)
    expect(unsubscribed).toContain('first')
    expect(first.windows.getLifecycle('first-widget').state).not.toBe('destroyed')

    collection.activateWorkspace('first')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('first')
    expect(mounted).toEqual(['first', 'second', 'first'])
    expect(subscribe).toHaveBeenCalledTimes(3)
    expect(unsubscribed).toContain('second')
    wrapper.unmount()
  })
})
