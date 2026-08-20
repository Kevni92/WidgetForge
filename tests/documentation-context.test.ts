import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { createCommandRegistry } from '../src/core/commands'
import { createWidgetDocumentationProvider } from '../src/vue/documentation-context'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'

const component = defineComponent(() => () => h('div'))

describe('WidgetDocumentationProvider', () => {
  it('enumerates documentation through public registry methods', () => {
    const widgets = createWidgetRegistry([defineWidget({ id: 'test.help', title: 'Help', description: 'Reference', component })])
    const commands = createCommandRegistry([{ name: 'help', widgetId: 'test.help', description: 'Open help.' }])
    const provider = createWidgetDocumentationProvider(widgets, commands)

    expect(provider.listWidgets().map((entry) => entry.id)).toEqual(['test.help'])
    expect(provider.listCommands().map((entry) => entry.name)).toEqual(['help'])
  })

  it('keeps commands optional for standalone widget hosts', () => {
    const widgets = createWidgetRegistry([defineWidget({ id: 'test.help', title: 'Help', component })])
    const provider = createWidgetDocumentationProvider(widgets)

    expect(provider.listCommands()).toEqual([])
  })
})
