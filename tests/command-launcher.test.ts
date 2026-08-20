import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCommandRegistry } from '../src/core/commands'
import { WidgetNavigationError, type WidgetNavigator } from '../src/core/navigation'
import CommandLauncher from '../src/vue/CommandLauncher.vue'

const commands = createCommandRegistry([
  { name: 'planet', widgetId: 'test.planet', arguments: [{ name: 'planetId', type: 'string', required: true }] },
])

describe('CommandLauncher', () => {
  let host: HTMLDivElement | null = null

  afterEach(() => {
    host?.remove()
    host = null
  })

  function mountLauncher(navigator: WidgetNavigator) {
    host = document.createElement('div')
    document.body.append(host)
    return mount(CommandLauncher, { attachTo: host, props: { commands, navigator, context: { target: { kind: 'launcher-window', windowInstanceId: 'launcher' } } } })
  }

  it('focuses the command field when opened and replaces through the typed launcher context', async () => {
    const navigate = vi.fn(() => ({ widgetId: 'test.planet', instanceId: 'launcher' }))
    const wrapper = mountLauncher({ navigate })
    await nextTick()

    expect(wrapper.find('.wf-command-launcher__intro').exists()).toBe(false)
    expect(wrapper.find('h2').exists()).toBe(false)
    expect(wrapper.get('button[type="submit"]').text()).toBe('Open')
    expect(document.activeElement).toBe(wrapper.get('input').element)
    await wrapper.get('input').setValue('planet ARC-01')
    await wrapper.get('form').trigger('submit')

    expect(navigate).toHaveBeenCalledWith({ widgetId: 'test.planet', parameters: { planetId: 'ARC-01' } }, { target: { kind: 'launcher-window', windowInstanceId: 'launcher' } })
  })

  it('keeps focus after invalid commands and closes explicitly with Escape', async () => {
    const navigate: WidgetNavigator = {
      navigate: () => {
        throw new WidgetNavigationError('invalid-parameters', { widgetId: 'test.planet', parameters: {} })
      },
    }
    const wrapper = mountLauncher(navigate)
    const input = wrapper.get('input')
    await input.setValue('planet ARC-01')
    await wrapper.get('form').trigger('submit')
    await nextTick()

    expect(wrapper.get('[data-command-input-feedback]').text()).toContain('invalid parameters')
    expect(document.activeElement).toBe(input.element)
    await input.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
