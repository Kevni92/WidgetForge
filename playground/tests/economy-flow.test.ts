import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.vue'

describe('economy reference workflow',()=>{
  beforeEach(()=>{window.localStorage.clear();vi.useFakeTimers()})
  afterEach(()=>vi.useRealTimers())

  it('links production, inventory and market to one colony and recovers the shared feed',async()=>{
    const wrapper=mount(App)
    await wrapper.vm.$nextTick()
    const colony=wrapper.get('select[aria-label="Colony selection"]')
    expect(wrapper.get('.production-widget').attributes('data-selection')).toBe('ARC-01')
    expect(wrapper.get('.inventory-widget').attributes('data-selection')).toBe('ARC-01')
    expect(wrapper.get('.market-widget').attributes('data-selection')).toBe('ARC-01')
    expect(wrapper.get('.production-widget').text()).toContain('Ferrite')
    expect(wrapper.get('.inventory-widget').text()).toContain('Ferrite')

    await colony.setValue('ARC-02');await wrapper.vm.$nextTick()
    expect(wrapper.get('.production-widget').attributes('data-selection')).toBe('ARC-02')
    expect(wrapper.get('.inventory-widget').attributes('data-selection')).toBe('ARC-02')
    expect(wrapper.get('.market-widget').attributes('data-selection')).toBe('ARC-02')
    expect(wrapper.get('.production-widget').text()).toContain('Titanium')
    expect(wrapper.get('.inventory-widget').text()).toContain('Titanium')

    vi.advanceTimersByTime(1400);await wrapper.vm.$nextTick()
    expect(wrapper.get('.production-widget').text()).toContain('Cycle 28418')

    await wrapper.get('[data-demo-action="feed"]').trigger('click');await wrapper.vm.$nextTick()
    expect(wrapper.get('.workspace-topbar__online').attributes('data-online')).toBe('false')
    expect(wrapper.get('.production-widget').text()).toContain('Production feed unavailable')
    expect(wrapper.get('.inventory-widget').text()).toContain('Inventory feed unavailable')
    expect(wrapper.get('.market-widget').text()).toContain('Market feed unavailable')

    await wrapper.get('[data-demo-action="feed"]').trigger('click');await wrapper.vm.$nextTick()
    expect(wrapper.get('.workspace-topbar__online').attributes('data-online')).toBe('true')
    expect(wrapper.get('.production-widget').text()).toContain('Titanium')
    expect(wrapper.get('.inventory-widget').text()).toContain('Titanium')
    wrapper.unmount()
  })

  it('uses tabs, view state and notifications in the order flow',async()=>{
    const wrapper=mount(App);await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-pane-id="economy-flow-root"]').attributes('data-pane-kind')).toBe('split')
    expect(wrapper.get('[data-pane-id="economy-flow-tabs"]').attributes('data-pane-kind')).toBe('tabs')
    await wrapper.get('.inventory-widget input[aria-label="Inventory filter"]').setValue('Ferrite')
    expect(wrapper.get('.inventory-widget').text()).toContain('Ferrite')
    const orderTab=wrapper.findAll('[data-pane-id="economy-flow-tabs"] [role="tab"]').find((tab)=>tab.text().includes('Orders'))
    expect(orderTab).toBeTruthy();await orderTab!.trigger('click');await wrapper.vm.$nextTick()
    expect(wrapper.get('.orders-widget').text()).toContain('Order management')
    await wrapper.get('[data-demo-order]').trigger('click');await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Order staged')
    wrapper.unmount()
  })
})
