import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WorkspaceSelectionActions from '../src/vue/WorkspaceSelectionActions.vue'

describe('WorkspaceSelectionActions', () => {
  it('exposes an accessible lock action for an unlocked selected window', async () => {
    const wrapper = mount(WorkspaceSelectionActions, { props: { instanceId: 'window-a', title: 'Trading', locked: false } })

    const action = wrapper.get('[data-window-selection-lock]')
    expect(action.text()).toContain('Lock')
    expect(action.attributes('aria-label')).toBe('Lock window Trading')
    await action.trigger('click')
    expect(wrapper.emitted('lock')).toEqual([['window-a']])
    wrapper.unmount()
  })

  it('switches to a visible unlock action and marks the locked state', async () => {
    const wrapper = mount(WorkspaceSelectionActions, { props: { instanceId: 'window-a', title: 'Trading', locked: true } })

    const action = wrapper.get('[data-window-selection-lock]')
    expect(action.text()).toContain('Unlock')
    expect(action.attributes('aria-label')).toBe('Unlock window Trading')
    expect(action.classes()).toContain('wf-workspace-selection-actions__toggle--active')
    await action.trigger('click')
    expect(wrapper.emitted('unlock')).toEqual([['window-a']])
    wrapper.unmount()
  })
})
