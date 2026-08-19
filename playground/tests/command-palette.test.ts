import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../src/App.vue'

let host: HTMLDivElement | null = null

describe('playground command palette', () => {
  beforeEach(() => {
    window.localStorage.clear()
    host = document.createElement('div')
    document.body.append(host)
  })
  afterEach(() => {
    host?.remove()
    host = null
  })

  async function openPalette(): Promise<void> {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    await nextTick()
  }

  async function execute(wrapper: ReturnType<typeof mount>, query: string): Promise<void> {
    const input = wrapper.get('[data-command-palette] input')
    await input.setValue(query)
    ;(input.element as HTMLInputElement).focus()
    await input.trigger('keydown', { key: 'Enter' })
    await nextTick()
  }

  it('uses Ctrl+K as primary access for layouts, registered commands and widget navigation', async () => {
    if (!host) throw new Error('test host is unavailable')
    const wrapper = mount(App, { attachTo: host })

    await openPalette()
    expect(wrapper.get('[role="dialog"]').text()).toContain('Command palette')
    await execute(wrapper, 'Load Trading layout')
    expect((wrapper.get('select[aria-label="Workspace layout"]').element as HTMLSelectElement).value).toBe('Trading')
    expect(wrapper.find('.alerts-widget').exists()).toBe(false)

    await openPalette()
    await execute(wrapper, 'alerts')
    expect(wrapper.find('.alerts-widget').exists()).toBe(true)

    const windowsBeforeModal = wrapper.findAll('.wf-window-frame').length
    await openPalette()
    await execute(wrapper, 'Critical Operations Review')
    expect(wrapper.findAll('.wf-window-frame').length).toBeGreaterThan(windowsBeforeModal)

    wrapper.unmount()
  })
})
