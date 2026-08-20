import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWorkspaceCollection } from '../src/core/workspace-collection'
import { createWorkspaceEditController } from '../src/core/workspace-edit'
import WorkspaceTabs from '../src/vue/WorkspaceTabs.vue'

function createCollection() {
  const collection = createWorkspaceCollection({ registry: createWidgetRegistry([]) })
  collection.createWorkspace({ id: 'alpha', name: 'Alpha', activate: true })
  collection.createWorkspace({ id: 'beta', name: 'Beta' })
  collection.createWorkspace({ id: 'gamma', name: 'Gamma' })
  return collection
}

describe('WorkspaceTabs', () => {
  it('activates tabs and supports inline rename with Enter, Escape, blur and F2', async () => {
    const collection = createCollection()
    const edit = createWorkspaceEditController()
    const wrapper = mount(WorkspaceTabs, { props: { manager: collection, edit }, attachTo: document.body })

    await wrapper.get('[data-workspace-tab="beta"]').trigger('click')
    expect(collection.getActiveWorkspaceId()).toBe('beta')

    await wrapper.get('[data-workspace-tab="beta"]').trigger('dblclick')
    const input = wrapper.get('input[aria-label="Rename workspace Beta"]')
    expect((input.element as HTMLInputElement).value).toBe('Beta')
    await input.setValue('Trading')
    await input.trigger('keydown', { key: 'Enter' })
    expect(collection.get('beta').name).toBe('Trading')
    expect(collection.get('beta').id).toBe('beta')

    await wrapper.get('[data-workspace-tab="beta"]').trigger('keydown', { key: 'F2' })
    await wrapper.get('input[aria-label="Rename workspace Trading"]').setValue('   ')
    await wrapper.get('input[aria-label="Rename workspace Trading"]').trigger('keydown', { key: 'Enter' })
    expect(collection.get('beta').name).toBe('Trading')

    await wrapper.get('[data-workspace-tab="beta"]').trigger('dblclick')
    await wrapper.get('input[aria-label="Rename workspace Trading"]').setValue('Discarded')
    await wrapper.get('input[aria-label="Rename workspace Trading"]').trigger('keydown', { key: 'Escape' })
    expect(collection.get('beta').name).toBe('Trading')
    wrapper.unmount()
  })

  it('creates an empty workspace, activates it and keeps the add action reachable', async () => {
    const collection = createCollection()
    const wrapper = mount(WorkspaceTabs, { props: { manager: collection }, attachTo: document.body })

    await wrapper.get('[data-workspace-add]').trigger('click')
    await nextTick()

    expect(collection.getActiveWorkspaceId()).toBe('workspace-4')
    expect(collection.get('workspace-4').name).toBe('Workspace 4')
    expect(collection.get('workspace-4').windows.list()).toHaveLength(0)
    expect(wrapper.find('[data-workspace-tab="workspace-4"]').exists()).toBe(true)
    expect(wrapper.find('[data-workspace-add]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows delete only in edit mode, confirms destructive deletion and protects locked/last workspaces', async () => {
    const collection = createCollection()
    const edit = createWorkspaceEditController()
    const wrapper = mount(WorkspaceTabs, { props: { manager: collection, edit }, attachTo: document.body })

    expect(wrapper.findAll('[data-workspace-delete]')).toHaveLength(0)
    edit.setTemporaryEdit(true)
    await nextTick()
    expect(wrapper.findAll('[data-workspace-delete]')).toHaveLength(3)

    await wrapper.get('[data-workspace-delete="beta"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Beta')
    expect(wrapper.get('[role="dialog"]').text()).toContain('windows, docks, panes and widget state')
    await wrapper.get('.wf-confirmation-dialog__cancel').trigger('click')
    expect(collection.get('beta').name).toBe('Beta')

    await wrapper.get('[data-workspace-delete="beta"]').trigger('click')
    edit.setTemporaryEdit(false)
    await nextTick()
    await wrapper.get('.wf-confirmation-dialog__confirm').trigger('click')
    expect(() => collection.get('beta')).toThrow()
    expect(collection.getActiveWorkspaceId()).toBe('alpha')

    edit.setTemporaryEdit(false)
    edit.setMode('locked')
    await nextTick()
    expect(wrapper.findAll('[data-workspace-delete]')).toHaveLength(0)
    expect(wrapper.get('[data-workspace-add]').attributes('disabled')).toBeDefined()

    edit.setMode('normal')
    edit.setTemporaryEdit(true)
    await nextTick()
    await wrapper.get('[data-workspace-delete="alpha"]').trigger('click')
    await wrapper.get('.wf-confirmation-dialog__confirm').trigger('click')
    expect(collection.getActiveWorkspaceId()).toBe('gamma')

    await nextTick()
    edit.setTemporaryEdit(true)
    expect(wrapper.findAll('[data-workspace-delete]')).toHaveLength(0)
    wrapper.unmount()
  })
})
