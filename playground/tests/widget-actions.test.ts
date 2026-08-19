import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.vue'

describe('playground widget actions', () => {
  beforeEach(() => { window.localStorage.clear(); vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('uses generic window actions for refresh, pin, follow and related navigation', async () => {
    const wrapper = mount(App)
    const telemetry = wrapper.get('[data-window-instance-id="telemetry-power"]')
    await telemetry.get('.wf-window-shell').trigger('mouseenter')
    await wrapper.vm.$nextTick()

    expect(telemetry.find('[data-window-header-action="refresh"]').exists()).toBe(false)
    expect(telemetry.get('[data-widget-action="refresh"]').attributes('title')).toBe('Refresh (Ctrl+R)')
    expect(telemetry.get('[data-widget-action="pin"]').attributes('aria-label')).toBe('Pin')
    expect(telemetry.get('[data-widget-action="follow"]').attributes('aria-label')).toBe('Follow')
    expect(telemetry.find('[aria-label="More widget actions"]').exists()).toBe(true)

    await telemetry.get('[data-widget-action="pin"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(telemetry.get('[data-resource-id="grid-power"]').attributes('data-pinned')).toBe('true')
    expect(telemetry.get('[data-widget-action="pin"]').attributes('aria-label')).toBe('Unpin')

    await telemetry.get('[data-widget-action="follow"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(telemetry.get('[data-resource-id="grid-power"]').attributes('data-following')).toBe('true')
    expect(telemetry.get('[data-widget-action="follow"]').attributes('aria-label')).toBe('Unfollow')

    await telemetry.get('[data-widget-action="refresh"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(telemetry.get('[data-resource-id="grid-power"]').attributes('data-last-action')).toBe('refresh')

    const before = wrapper.findAll('.wf-window-frame').length
    await telemetry.get('[data-overflow-trigger]').trigger('click')
    await wrapper.vm.$nextTick()
    const openColony = document.querySelector<HTMLElement>('[data-overflow-menu] [data-widget-action="open-colony"]')
    expect(openColony).not.toBeNull()
    openColony?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.wf-window-frame').length).toBe(before + 1)
    expect(wrapper.findAll('[data-widget-id="planet.summary"]').length).toBeGreaterThan(1)
    wrapper.unmount()
  })
})
