import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WfIcon, { type WfIconName } from '../src/vue/WfIcon.vue'

const iconNames: readonly WfIconName[] = [
  'lock', 'unlock', 'close', 'minimize', 'restore', 'dock', 'undock', 'inspector', 'layout', 'style',
  'link', 'unlink', 'move', 'reset', 'connections', 'undo', 'redo', 'border-top', 'border-right',
  'border-bottom', 'border-left', 'check', 'edit',
]

describe('WfIcon', () => {
  it('renders the shared currentColor SVG primitive with an accessible decorative contract', () => {
    const wrapper = mount(WfIcon, { props: { name: 'lock' } })
    const svg = wrapper.get('svg')

    expect(svg.attributes('viewBox')).toBe('0 0 24 24')
    expect(svg.attributes('stroke')).toBe('currentColor')
    expect(svg.attributes('aria-hidden')).toBe('true')
    expect(svg.attributes('focusable')).toBe('false')
  })

  it.each(iconNames)('provides visible geometry for %s', (name) => {
    const wrapper = mount(WfIcon, { props: { name } })
    expect(wrapper.get('svg').element.childElementCount).toBeGreaterThan(0)
  })
})
