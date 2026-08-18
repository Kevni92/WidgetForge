import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DockingOverlay from '../src/vue/DockingOverlay.vue'

describe('DockingOverlay', () => {
  it('renders all five targets and the exact active result preview from props', async () => {
    const wrapper = mount(DockingOverlay, { props: { targetRect: { x: 100, y: 50, width: 400, height: 300 }, activeZone: 'left', sourceId: 'source', targetId: 'target' } })
    expect(wrapper.findAll('[data-docking-zone]')).toHaveLength(5)
    expect(wrapper.get('[data-docking-zone="left"]').classes()).toContain('wf-docking-overlay__target--active')
    expect(wrapper.get('.wf-docking-overlay__preview').attributes('style')).toContain('width: 200px')
    expect(wrapper.attributes('data-docking-source')).toBe('source')

    await wrapper.setProps({ activeZone: 'center' })
    expect(wrapper.get('[data-docking-zone="center"]').classes()).toContain('wf-docking-overlay__target--active')
    expect(wrapper.get('.wf-docking-overlay__preview').attributes('style')).toContain('width: 400px')
  })
})
