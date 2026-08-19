import { defineComponent, h, markRaw } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { SelectionProvider, createSelectionStore } from 'widgetforge'
import App from '../src/App.vue'

function mountApp() {
  const store = markRaw(createSelectionStore())
  const Root = defineComponent({ setup: () => () => h(SelectionProvider, { store }, () => h(App)) })
  return mount(Root)
}

describe('playground selection context', () => {
  beforeEach(() => window.localStorage.clear())

  it('updates multiple widgets, keeps pinned Market fixed and never opens new widget instances', async () => {
    const wrapper = mountApp()
    await wrapper.vm.$nextTick()
    const colony = wrapper.get('select[aria-label="Colony selection"]')
    const market = () => wrapper.get('[data-window-instance-id="market-main"] .market-widget')
    const telemetry = () => wrapper.get('[data-window-instance-id="telemetry-power"] [data-resource-id="grid-power"]')
    const windowCount = wrapper.findAll('.wf-window-frame').length

    expect((colony.element as HTMLSelectElement).value).toBe('ARC-01')
    expect(market().attributes('data-selection')).toBe('ARC-01')
    expect(telemetry().attributes('data-selection')).toBe('ARC-01')

    await colony.setValue('ARC-02')
    await wrapper.vm.$nextTick()
    expect(market().attributes('data-selection')).toBe('ARC-02')
    expect(telemetry().attributes('data-selection')).toBe('ARC-02')
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(windowCount)

    await wrapper.get('[data-window-instance-id="market-main"] [data-market-pin]').trigger('click')
    expect(market().attributes('data-following')).toBe('false')
    await colony.setValue('ARC-03')
    await wrapper.vm.$nextTick()
    expect(market().attributes('data-selection')).toBe('ARC-02')
    expect(telemetry().attributes('data-selection')).toBe('ARC-03')
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(windowCount)

    await wrapper.get('[data-window-instance-id="market-main"] [data-market-follow]').trigger('click')
    expect(market().attributes('data-following')).toBe('true')
    expect(market().attributes('data-selection')).toBe('ARC-03')
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(windowCount)
    wrapper.unmount()
  })
})
