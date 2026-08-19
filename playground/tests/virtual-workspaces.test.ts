import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.vue'

const COLLECTION_STORAGE_KEY = 'widgetforge.playground.workspaces.v1'

describe('virtual desktop playground', () => {
  beforeEach(() => { window.localStorage.clear(); vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('offers Command, Trading and Operations as independent persisted workspaces', async () => {
    const wrapper = mount(App)
    expect(wrapper.findAll('[data-workspace-tab]')).toHaveLength(3)
    expect(wrapper.get('[data-workspace-tab="command"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(5)

    await wrapper.get('[data-workspace-tab="trading"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-active-workspace]').attributes('data-active-workspace')).toBe('trading')
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(2)
    await wrapper.get('[data-window-instance-id="telemetry-power"] .wf-window-shell__close').trigger('click')
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(1)

    await wrapper.get('[data-workspace-tab="operations"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(4)

    await wrapper.get('[data-workspace-tab="command"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(5)
    await wrapper.get('[data-workspace-tab="trading"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(1)

    const persisted = JSON.parse(window.localStorage.getItem(COLLECTION_STORAGE_KEY) ?? '{}') as { activeWorkspaceId?: string; workspaces?: unknown[] }
    expect(persisted.activeWorkspaceId).toBe('trading')
    expect(persisted.workspaces).toHaveLength(3)
    wrapper.unmount()

    const restored = mount(App)
    expect(restored.get('[data-workspace-tab="trading"]').attributes('aria-pressed')).toBe('true')
    expect(restored.findAll('.wf-window-frame')).toHaveLength(1)
    restored.unmount()
  })
})
