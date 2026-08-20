import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import HelpReferenceDetail from '../src/vue/HelpReferenceDetail.vue'
import HelpReferenceList from '../src/vue/HelpReferenceList.vue'
import HelpWidget from '../src/vue/HelpWidget.vue'
import { createCommandRegistry } from '../src/core/commands'
import { createWidgetDocumentationProvider, provideWidgetDocumentation } from '../src/vue/documentation-context'
import { createWidgetPane } from '../src/core/pane'
import PaneHost from '../src/vue/PaneHost.vue'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'

const component = defineComponent(() => () => h('div'))

function createProvider() {
  const widgets = createWidgetRegistry([
    defineWidget({
      id: 'planet.summary',
      title: 'Colony Overview',
      description: 'Inspect a colony and its current operational state.',
      component,
      parameters: {
        planetId: { type: 'string', required: true, description: 'Colony identifier.', example: 'ARC-01' },
        compact: { type: 'boolean', default: false, description: 'Use the compact layout.', example: true },
      },
    }),
    defineWidget({
      id: 'market.ticker',
      title: 'Commodity Exchange',
      description: 'Compare current commodity prices.',
      component,
      parameters: { rows: { type: 'number', default: 10, description: 'Number of rows.', example: 10 } },
    }),
  ])
  const commands = createCommandRegistry([
    { name: 'planet', widgetId: 'planet.summary', description: 'Open a colony overview.', examples: ['planet ARC-01'], arguments: [{ name: 'planetId', type: 'string', required: true, description: 'Colony identifier.', example: 'ARC-01' }] },
    { name: 'market', widgetId: 'market.ticker', description: 'Open the commodity exchange.', examples: ['market 10'], arguments: [{ name: 'rows', type: 'number', default: 10, description: 'Number of rows.', example: 10 }] },
  ])
  return createWidgetDocumentationProvider(widgets, commands)
}

function mountWithProvider() {
  const provider = createProvider()
  const Host = defineComponent({
    setup: () => {
      provideWidgetDocumentation(provider)
      return () => h(HelpWidget)
    },
  })
  return mount(Host, { attachTo: document.body })
}

describe('HelpWidget', () => {
  it('renders sorted widget and command references and supports filtering/search', async () => {
    const wrapper = mountWithProvider()
    await flushPromises()

    expect(wrapper.findAll('[data-help-entry]').map((entry) => entry.attributes('data-help-entry'))).toEqual([
      'widget:planet.summary',
      'widget:market.ticker',
      'command:market',
      'command:planet',
    ])

    await wrapper.get('[aria-label="Filter references"]').setValue('commands')
    expect(wrapper.findAll('[data-help-entry]').map((entry) => entry.attributes('data-help-entry'))).toEqual(['command:market', 'command:planet'])

    await wrapper.get('[aria-label="Search widgets and commands"]').setValue('planetid')
    expect(wrapper.findAll('[data-help-entry]').map((entry) => entry.attributes('data-help-entry'))).toEqual(['command:planet'])
    expect(wrapper.get('[data-help-entry="command:planet"]').text()).toContain('Open a colony overview.')
  })

  it('opens details, exposes parameter contracts, returns to the list and copies usage', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const wrapper = mountWithProvider()
    await flushPromises()

    await wrapper.get('[data-help-entry="widget:market.ticker"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-help-detail-heading]').text()).toBe('Commodity Exchange')
    expect(wrapper.get('[data-help-detail]').text()).toContain('rows')
    expect(wrapper.get('[data-help-detail]').text()).toContain('Number of rows.')
    await wrapper.get('[data-help-back]').trigger('click')
    await flushPromises()
    await nextTick()
    expect(wrapper.find('[data-help-detail]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('[aria-label="Search widgets and commands"]').element)

    await wrapper.get('[data-help-entry="command:market"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-help-copy]').trigger('click')
    expect(writeText).toHaveBeenCalledWith('market [rows]')
    expect(wrapper.get('[data-help-copy]').text()).toBe('Copied')
  })

  it('shows a neutral empty state when no documentation provider is available', () => {
    const wrapper = mount(HelpWidget)

    expect(wrapper.text()).toContain('Documentation unavailable')
    expect(wrapper.text()).not.toContain('market')
  })

  it('receives the registry through a direct PaneHost without importing registry internals', async () => {
    const registry = createWidgetRegistry([defineWidget({ id: 'widgetforge.help', title: 'Help & Reference', component: HelpWidget })])
    const pane = createWidgetPane({ id: 'help-root', widgetId: 'widgetforge.help', instanceId: 'help' })
    const wrapper = mount(PaneHost, { props: { pane, registry } })
    await flushPromises()

    expect(wrapper.find('[data-help-entry="widget:widgetforge.help"]').exists()).toBe(true)
  })
})

describe('HelpReferenceList', () => {
  it('uses keyboard-focusable buttons and emits selection', async () => {
    const entry = createProvider().listWidgets()[0]!
    const snapshotEntry = {
      kind: 'widget' as const,
      key: 'widget:test',
      id: entry.id,
      title: entry.title,
      parameterCount: entry.parameters.length,
      commands: [],
      documentation: entry,
    }
    const wrapper = mount(HelpReferenceList, { props: { entries: [snapshotEntry] } })

    const button = wrapper.get('[data-help-entry="widget:test"]')
    expect(button.element.tagName).toBe('BUTTON')
    await button.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['widget:test']])
  })
})

describe('HelpReferenceDetail', () => {
  it('renders command arguments and emits back/copy actions', async () => {
    const command = createProvider().listCommands()[0]!
    const entry = {
      kind: 'command' as const,
      key: 'command:planet',
      name: command.name,
      widgetId: command.widgetId,
      documentation: command,
    }
    const wrapper = mount(HelpReferenceDetail, { props: { entry } })

    expect(wrapper.get('[data-help-detail-heading]').text()).toBe('planet')
    expect(wrapper.get('table').text()).toContain('planetId')
    await wrapper.get('[data-help-copy]').trigger('click')
    expect(wrapper.emitted('copy')?.[0]).toEqual(['planet <planetId>', 'usage:planet'])
    await wrapper.get('[data-help-back]').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })
})
