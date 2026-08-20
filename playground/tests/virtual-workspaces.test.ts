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
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(6)

    await wrapper.get('[data-workspace-tab="trading"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-active-workspace]').attributes('data-active-workspace')).toBe('trading')
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(3)
    await wrapper.get('[data-window-instance-id="market-main"] .wf-window-shell__close').trigger('click')
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(2)
    expect(wrapper.find('[data-window-instance-id="telemetry-power"]').exists()).toBe(true)

    await wrapper.get('[data-workspace-tab="operations"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(5)

    await wrapper.get('[data-workspace-tab="command"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(6)
    await wrapper.get('[data-workspace-tab="trading"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(2)
    expect(wrapper.find('[data-window-instance-id="market-main"]').exists()).toBe(false)

    const persisted = JSON.parse(window.localStorage.getItem(COLLECTION_STORAGE_KEY) ?? '{}') as { activeWorkspaceId?: string; workspaces?: unknown[] }
    expect(persisted.activeWorkspaceId).toBe('trading')
    expect(persisted.workspaces).toHaveLength(3)
    wrapper.unmount()

    const restored = mount(App)
    expect(restored.get('[data-workspace-tab="trading"]').attributes('aria-pressed')).toBe('true')
    expect(restored.findAll('.wf-window-frame')).toHaveLength(2)
    expect(restored.find('[data-window-instance-id="telemetry-power"]').exists()).toBe(true)
    restored.unmount()
  })

  it('demonstrates public tab management for rename, add and confirmed delete', async () => {
    const wrapper = mount(App)

    await wrapper.get('[data-workspace-tab="trading"]').trigger('dblclick')
    await wrapper.get('input[aria-label="Rename workspace Trading"]').setValue('Markets')
    await wrapper.get('input[aria-label="Rename workspace Trading"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.get('[data-workspace-tab="trading"]').text()).toBe('Markets')

    await wrapper.get('[data-workspace-add]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-active-workspace]').attributes('data-active-workspace')).toBe('workspace-4')
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(0)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-workspace-delete]')).toHaveLength(4)
    await wrapper.get('[data-workspace-delete="workspace-4"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Workspace 4')
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }))
    await wrapper.get('.wf-confirmation-dialog__confirm').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-workspace-tab="workspace-4"]').exists()).toBe(false)
    expect(wrapper.get('[data-active-workspace]').attributes('data-active-workspace')).toBe('operations')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }))
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-workspace-delete="operations"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }))
    await wrapper.get('.wf-confirmation-dialog__confirm').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-workspace-tab="operations"]').exists()).toBe(false)
    const persisted = JSON.parse(window.localStorage.getItem(COLLECTION_STORAGE_KEY) ?? '{}') as { workspaces?: Array<{ id: string; name: string }> }
    expect(persisted.workspaces?.map((workspace) => workspace.name)).toEqual(['Command', 'Markets'])
    wrapper.unmount()

    const restored = mount(App)
    expect(restored.find('[data-workspace-tab="operations"]').exists()).toBe(false)
    expect(restored.get('[data-workspace-tab="trading"]').text()).toBe('Markets')
    restored.unmount()
  })
})
