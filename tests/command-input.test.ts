import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createCommandRegistry } from '../src/core/commands'
import { WidgetNavigationError, type WidgetNavigator } from '../src/core/navigation'
import CommandInput from '../src/vue/CommandInput.vue'

function createCommands() {
  return createCommandRegistry([
    {
      name: 'planet',
      aliases: ['p'],
      widgetId: 'planet.summary',
      arguments: [{ name: 'planetId', type: 'string', required: true }],
    },
  ])
}

describe('CommandInput', () => {
  it('parses commands and executes the resulting intent through WidgetNavigator', async () => {
    const navigate = vi.fn(() => ({ widgetId: 'planet.summary', instanceId: 'planet-1' }))
    const navigator: WidgetNavigator = { navigate }
    const wrapper = mount(CommandInput, { props: { commands: createCommands(), navigator } })

    await wrapper.get('input').setValue('p ARC-01')
    await wrapper.get('form').trigger('submit')

    expect(navigate).toHaveBeenCalledWith({
      widgetId: 'planet.summary',
      parameters: { planetId: 'ARC-01' },
    })
    expect(wrapper.text()).toContain('Opened planet.summary')
    expect(wrapper.get('input').element.value).toBe('')
    expect(wrapper.emitted('executed')?.[0]?.[0]).toEqual({ widgetId: 'planet.summary', instanceId: 'planet-1' })
  })

  it('shows parser errors without invoking navigation', async () => {
    const navigate = vi.fn()
    const wrapper = mount(CommandInput, {
      props: { commands: createCommands(), navigator: { navigate } },
    })

    await wrapper.get('input').setValue('unknown value')
    await wrapper.get('form').trigger('submit')

    expect(navigate).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('unknown command')
    expect(wrapper.emitted('error')).toHaveLength(1)
  })

  it('shows navigation validation errors and keeps the submitted input for correction', async () => {
    const navigator: WidgetNavigator = {
      navigate: () => {
        throw new WidgetNavigationError('invalid-parameters', {
          widgetId: 'planet.summary',
          parameters: { planetId: 'ARC-01' },
        })
      },
    }
    const wrapper = mount(CommandInput, { props: { commands: createCommands(), navigator } })

    await wrapper.get('input').setValue('planet ARC-01')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('[role="alert"]').text()).toContain('invalid parameters')
    expect(wrapper.get('input').element.value).toBe('planet ARC-01')
  })

  it('supports consumer placeholder and submit label without domain assumptions', () => {
    const wrapper = mount(CommandInput, {
      props: {
        commands: createCommands(),
        navigator: { navigate: vi.fn() },
        placeholder: 'Type action',
        submitLabel: 'Execute',
      },
    })

    expect(wrapper.get('input').attributes('placeholder')).toBe('Type action')
    expect(wrapper.get('button').text()).toBe('Execute')
  })
})
