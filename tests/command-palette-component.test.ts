import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCommandPaletteProvider, createCommandPaletteRegistry } from '../src/core/command-palette'
import CommandPalette from '../src/vue/CommandPalette.vue'

function registry(execute = vi.fn()) {
  return {
    execute,
    value: createCommandPaletteRegistry([
      createCommandPaletteProvider('test', [
        { id: 'test:alpha', label: 'Alpha action', category: 'Actions', keywords: ['first'], execute },
        { id: 'test:disabled', label: 'Disabled action', category: 'Actions', disabled: true, execute: vi.fn() },
        { id: 'test:beta', label: 'Beta widget', category: 'Widgets', shortcut: 'Ctrl+B', execute: vi.fn() },
      ]),
    ]),
  }
}

const wrappers: VueWrapper[] = []
function mountPalette(registryValue: ReturnType<typeof registry>['value'], shortcut?: string): VueWrapper {
  const host = document.createElement('div')
  document.body.append(host)
  const wrapper = mount(CommandPalette, {
    attachTo: host,
    props: shortcut === undefined ? { registry: registryValue } : { registry: registryValue, shortcut },
  })
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

describe('CommandPalette', () => {
  it('opens with Ctrl+K, focuses the combobox and exposes dialog/listbox semantics', async () => {
    const { value } = registry()
    const wrapper = mountPalette(value)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    await nextTick()

    expect(wrapper.get('[role="dialog"]').attributes('aria-modal')).toBe('true')
    expect(wrapper.get('[role="combobox"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)
    expect(document.activeElement).toBe(wrapper.get('input').element)
  })

  it('searches, skips disabled results with arrows and executes the active item with Enter', async () => {
    const alpha = vi.fn()
    const { value } = registry(alpha)
    const wrapper = mountPalette(value)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    await nextTick()
    const input = wrapper.get('input')
    await input.setValue('alpha')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(1)
    await input.trigger('keydown', { key: 'Enter' })

    expect(alpha).toHaveBeenCalledOnce()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.emitted('executed')?.[0]?.[0]).toMatchObject({ id: 'test:alpha' })
  })

  it('supports Arrow navigation, Escape and a focus trap without selecting disabled items', async () => {
    const { value } = registry()
    const wrapper = mountPalette(value)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    await nextTick()

    const input = wrapper.get('input')
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.get('[aria-selected="true"]').attributes('data-palette-item')).toBe('test:beta')

    const lastButton = wrapper.findAll('button').at(-1)
    lastButton?.element.focus()
    await lastButton?.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(input.element)

    await input.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('supports a configurable shortcut and removes its global listener on unmount', async () => {
    const { value } = registry()
    const wrapper = mountPalette(value, 'Ctrl+Shift+P')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true, bubbles: true }))
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true, bubbles: true }))
  })
})
