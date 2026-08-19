import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  CommandPaletteDefinitionError,
  createCommandPaletteProvider,
  createCommandPaletteRegistry,
  createCommandRegistryPaletteProvider,
  createWidgetActionPaletteProvider,
  createWidgetRegistryPaletteProvider,
  rankCommandPaletteItems,
  type CommandPaletteItem,
} from '../src/core/command-palette'
import { createCommandRegistry } from '../src/core/commands'
import type { WidgetNavigator } from '../src/core/navigation'
import { defineWidget } from '../src/core/widget'
import type { WidgetActionBinding } from '../src/core/widget-actions'
import { createWidgetRegistry } from '../src/core/widget-registry'

function item(id: string, label: string, category = 'General', priority = 0): CommandPaletteItem {
  return { id, label, category, priority, execute: vi.fn() }
}

describe('CommandPaletteRegistry', () => {
  it('ranks exact, substring, keyword and fuzzy matches deterministically', () => {
    const items: CommandPaletteItem[] = [
      { ...item('widget:market', 'Commodity Exchange', 'Widgets', 10), keywords: ['market', 'ticker'] },
      { ...item('command:metrics', 'Metrics console', 'Commands', 5), keywords: ['telemetry'] },
      item('workspace:reset', 'Reset workspace', 'Workspace', 20),
    ]

    expect(rankCommandPaletteItems(items, 'market').map((result) => result.item.id)).toEqual(['widget:market'])
    expect(rankCommandPaletteItems(items, 'exchange').map((result) => result.item.id)).toEqual(['widget:market'])
    expect(rankCommandPaletteItems(items, 'mtrcs').map((result) => result.item.id)).toEqual(['command:metrics'])
    expect(rankCommandPaletteItems(items).map((result) => result.item.id)).toEqual([
      'workspace:reset',
      'widget:market',
      'command:metrics',
    ])
  })

  it('registers dynamic consumer providers and rejects duplicate provider/item ids', () => {
    let label = 'First'
    const registry = createCommandPaletteRegistry([
      createCommandPaletteProvider('consumer', () => [item('consumer:one', label)]),
    ])

    expect(registry.search()[0]?.item.label).toBe('First')
    label = 'Updated'
    expect(registry.search()[0]?.item.label).toBe('Updated')
    expect(() => registry.registerProvider(createCommandPaletteProvider('consumer', []))).toThrow(CommandPaletteDefinitionError)

    registry.registerProvider(createCommandPaletteProvider('other', [item('consumer:one', 'Duplicate')]))
    expect(() => registry.listItems()).toThrow(/duplicate command palette item id/)
  })

  it('adapts CommandRegistry and disables commands that require unresolved input', () => {
    const commands = createCommandRegistry([
      { name: 'planet', widgetId: 'planet.summary', arguments: [{ name: 'planetId', type: 'string', required: true }] },
      { name: 'market', aliases: ['mkt'], widgetId: 'market.ticker', arguments: [{ name: 'rows', type: 'number', default: 8 }] },
    ])
    const navigate = vi.fn(() => ({ widgetId: 'market.ticker', instanceId: 'market-1' }))
    const provider = createCommandRegistryPaletteProvider(commands, { navigate })
    const registry = createCommandPaletteRegistry([provider])

    expect(registry.search('planet')[0]?.item.disabled).toBe(true)
    const market = registry.search('mkt')[0]?.item
    expect(market?.disabled).toBe(false)
    market?.execute()
    expect(navigate).toHaveBeenCalledWith({ widgetId: 'market.ticker', parameters: { rows: 8 } })
  })

  it('adapts registered widgets and only enables manifests resolvable with defaults', () => {
    const component = defineComponent(() => () => h('div'))
    const widgets = createWidgetRegistry([
      defineWidget({ id: 'planet.summary', title: 'Planet', component, parameters: { planetId: { type: 'string', required: true } } }),
      defineWidget({ id: 'market.ticker', title: 'Market', component, parameters: { rows: { type: 'number', default: 4 } } }),
    ])
    const navigate = vi.fn(() => ({ widgetId: 'market.ticker', instanceId: 'market-1' }))
    const navigator: WidgetNavigator = { navigate }
    const registry = createCommandPaletteRegistry([createWidgetRegistryPaletteProvider(widgets, navigator)])

    expect(registry.search('planet')[0]?.item.disabled).toBe(true)
    registry.search('market')[0]?.item.execute()
    expect(navigate).toHaveBeenCalledWith({ widgetId: 'market.ticker', parameters: { rows: 4 } })
  })

  it('adapts visible WidgetAction bindings without reaching into widget internals', () => {
    const execute = vi.fn()
    const hidden = vi.fn()
    const bindings: WidgetActionBinding[] = [
      { action: { id: 'refresh', label: 'Refresh data', icon: '↻', shortcut: 'Ctrl+R' }, execute },
      { action: { id: 'hidden', label: 'Hidden', icon: '×', visible: false }, execute: hidden },
    ]
    const registry = createCommandPaletteRegistry([
      createWidgetActionPaletteProvider(bindings, { providerId: 'market-actions', instanceLabel: 'Market' }),
    ])

    expect(registry.listItems()).toHaveLength(1)
    const refresh = registry.search('refresh')[0]?.item
    expect(refresh?.shortcut).toBe('Ctrl+R')
    refresh?.execute()
    expect(execute).toHaveBeenCalledOnce()
    expect(hidden).not.toHaveBeenCalled()
  })
})
