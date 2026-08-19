import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import WidgetActionToolbar from '../src/vue/WidgetActionToolbar.vue'
import type { WidgetActionBinding } from '../src/core/widget-actions'

function binding(id: string, options: Partial<WidgetActionBinding['action']> = {}): WidgetActionBinding {
  return { action: { id, label: id, icon: id[0] ?? '?', ...options }, execute: vi.fn() }
}

describe('WidgetActionToolbar', () => {
  it('uses the available size, keeps groups together and exposes all overflow actions', async () => {
    const bindings = [
      binding('critical', { priority: 100, alwaysVisible: true }),
      binding('tracking-one', { priority: 80, group: 'tracking' }),
      binding('tracking-two', { priority: 70, group: 'tracking' }),
      binding('secondary', { priority: 10 }),
    ]
    const wrapper = mount(WidgetActionToolbar, { props: { bindings, availableSize: 105, compact: true, maxVisible: 10, overflowButtonSize: 34 }, attachTo: document.body })

    expect(wrapper.find('[data-widget-action="critical"]').exists()).toBe(true)
    expect(wrapper.find('[data-widget-action="tracking-one"]').exists()).toBe(false)
    expect(wrapper.find('[data-overflow-trigger]').exists()).toBe(true)
    expect(wrapper.find('[data-overflow-trigger]').attributes('aria-haspopup')).toBe('menu')

    await wrapper.get('[data-overflow-trigger]').trigger('click')
    await nextTick()
    const menu = document.querySelector<HTMLElement>('[data-overflow-menu]')
    expect(menu).not.toBeNull()
    expect(menu?.querySelectorAll('[role="menuitem"]')).toHaveLength(2)
    expect(document.activeElement).toBe(menu?.querySelector('[role="menuitem"]'))

    menu?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(menu?.querySelectorAll('[role="menuitem"]')[1])
    menu?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await nextTick()
    expect(document.querySelector('[data-overflow-menu]')).toBeNull()
    expect(document.activeElement).toBe(wrapper.get('[data-overflow-trigger]').element)
    wrapper.unmount()
  })

  it('keeps disabled actions in the menu, executes through the original binding and closes on outside pointer', async () => {
    const disabled = binding('disabled', { disabled: true })
    const executable = binding('executable')
    const wrapper = mount(WidgetActionToolbar, { props: { bindings: [disabled, executable], availableSize: 40, compact: true, maxVisible: 10, overflowButtonSize: 34 }, attachTo: document.body })
    await wrapper.get('[data-overflow-trigger]').trigger('click')
    await nextTick()
    const menu = document.querySelector<HTMLElement>('[data-overflow-menu]')
    expect(menu?.querySelector('[data-widget-action="disabled"]')?.hasAttribute('disabled')).toBe(true)
    expect(document.activeElement).toBe(menu?.querySelector('[data-widget-action="executable"]'))

    ;(menu?.querySelector('[data-widget-action="executable"]') as HTMLElement)?.click()
    await nextTick()
    expect(executable.execute).toHaveBeenCalledOnce()
    expect(document.querySelector('[data-overflow-menu]')).toBeNull()

    await wrapper.get('[data-overflow-trigger]').trigger('click')
    await nextTick()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(document.querySelector('[data-overflow-menu]')).toBeNull()
    wrapper.unmount()
  })

  it('supports vertical toolbars and keeps visible state reactive', async () => {
    const visible = binding('visible')
    const hidden = binding('hidden', { visible: false })
    const wrapper = mount(WidgetActionToolbar, { props: { bindings: [visible, hidden], orientation: 'vertical', availableSize: 40, compact: true, maxVisible: 10 }, attachTo: document.body })
    expect(wrapper.get('[role="toolbar"]').attributes('aria-orientation')).toBe('vertical')
    expect(wrapper.get('[role="toolbar"]').attributes('data-overflow-orientation')).toBe('vertical')
    expect(wrapper.find('[data-widget-action="hidden"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
