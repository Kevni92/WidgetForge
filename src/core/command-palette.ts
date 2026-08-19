import type { CommandDefinition, CommandRegistry } from './commands'
import type { WidgetNavigator } from './navigation'
import type { WidgetActionBinding } from './widget-actions'
import type { WidgetManifest } from './widget'
import type { WidgetRegistry } from './widget-registry'

export interface CommandPaletteItem {
  readonly id: string
  readonly label: string
  readonly category: string
  readonly keywords?: readonly string[]
  readonly shortcut?: string
  readonly icon?: string
  readonly priority?: number
  readonly disabled?: boolean
  execute(): void
}

export interface CommandPaletteProvider {
  readonly id: string
  items(): readonly CommandPaletteItem[]
}

export interface CommandPaletteSearchResult {
  readonly item: CommandPaletteItem
  readonly score: number
}

export class CommandPaletteDefinitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CommandPaletteDefinitionError'
  }
}

const identifierPattern = /^[a-z][a-z0-9]*(?:[.:-][a-z0-9]+)*$/

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function validateProvider(provider: CommandPaletteProvider): void {
  if (!identifierPattern.test(provider.id)) throw new CommandPaletteDefinitionError(`invalid command palette provider id "${provider.id}"`)
}

function validateItem(item: CommandPaletteItem): void {
  if (!item.id.trim()) throw new CommandPaletteDefinitionError('command palette item id must not be empty')
  if (!item.label.trim()) throw new CommandPaletteDefinitionError(`command palette item "${item.id}" label must not be empty`)
  if (!item.category.trim()) throw new CommandPaletteDefinitionError(`command palette item "${item.id}" category must not be empty`)
  if (item.shortcut !== undefined && !item.shortcut.trim()) throw new CommandPaletteDefinitionError(`command palette item "${item.id}" shortcut must not be empty`)
  if (item.icon !== undefined && !item.icon.trim()) throw new CommandPaletteDefinitionError(`command palette item "${item.id}" icon must not be empty`)
  if (item.priority !== undefined && (!Number.isFinite(item.priority) || !Number.isInteger(item.priority))) {
    throw new CommandPaletteDefinitionError(`command palette item "${item.id}" priority must be a finite integer`)
  }
  for (const keyword of item.keywords ?? []) {
    if (!keyword.trim()) throw new CommandPaletteDefinitionError(`command palette item "${item.id}" keyword must not be empty`)
  }
}

function subsequenceScore(candidate: string, query: string): number | null {
  let queryIndex = 0
  let first = -1
  let last = -1
  for (let candidateIndex = 0; candidateIndex < candidate.length && queryIndex < query.length; candidateIndex += 1) {
    if (candidate[candidateIndex] !== query[queryIndex]) continue
    if (first < 0) first = candidateIndex
    last = candidateIndex
    queryIndex += 1
  }
  if (queryIndex !== query.length) return null
  const span = last - first + 1
  return 80 + first + Math.max(0, span - query.length)
}

function textScore(candidate: string, query: string, base: number): number | null {
  const normalizedCandidate = normalize(candidate)
  if (!normalizedCandidate) return null
  if (normalizedCandidate === query) return base
  if (normalizedCandidate.startsWith(query)) return base + 8
  const index = normalizedCandidate.indexOf(query)
  if (index >= 0) return base + 18 + index
  const fuzzy = subsequenceScore(normalizedCandidate, query)
  return fuzzy === null ? null : base + fuzzy
}

function tokenScore(item: CommandPaletteItem, token: string): number | null {
  const candidates: Array<readonly [string, number]> = [
    [item.label, 0],
    [item.id, 12],
    [item.category, 32],
    ...(item.keywords ?? []).map((keyword) => [keyword, 20] as const),
  ]
  let best: number | null = null
  for (const [candidate, base] of candidates) {
    const score = textScore(candidate, token, base)
    if (score !== null && (best === null || score < best)) best = score
  }
  return best
}

function compareItems(left: CommandPaletteSearchResult, right: CommandPaletteSearchResult): number {
  if (left.score !== right.score) return left.score - right.score
  const leftPriority = left.item.priority ?? 0
  const rightPriority = right.item.priority ?? 0
  if (leftPriority !== rightPriority) return rightPriority - leftPriority
  const category = left.item.category.localeCompare(right.item.category)
  if (category !== 0) return category
  const label = left.item.label.localeCompare(right.item.label)
  if (label !== 0) return label
  return left.item.id.localeCompare(right.item.id)
}

export function rankCommandPaletteItems(items: readonly CommandPaletteItem[], query = ''): readonly CommandPaletteSearchResult[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean)
  const results: CommandPaletteSearchResult[] = []
  for (const item of items) {
    validateItem(item)
    let score = 0
    let matches = true
    for (const token of tokens) {
      const tokenResult = tokenScore(item, token)
      if (tokenResult === null) {
        matches = false
        break
      }
      score += tokenResult
    }
    if (matches) results.push({ item, score })
  }
  return results.sort(compareItems)
}

export class CommandPaletteRegistry {
  private readonly providers = new Map<string, CommandPaletteProvider>()

  constructor(providers: readonly CommandPaletteProvider[] = []) {
    for (const provider of providers) this.registerProvider(provider)
  }

  registerProvider(provider: CommandPaletteProvider): () => void {
    validateProvider(provider)
    if (this.providers.has(provider.id)) throw new CommandPaletteDefinitionError(`command palette provider "${provider.id}" is already registered`)
    this.providers.set(provider.id, provider)
    return () => this.unregisterProvider(provider.id)
  }

  unregisterProvider(providerId: string): boolean {
    return this.providers.delete(providerId)
  }

  listProviders(): readonly CommandPaletteProvider[] {
    return [...this.providers.values()]
  }

  listItems(): readonly CommandPaletteItem[] {
    const items: CommandPaletteItem[] = []
    const ids = new Set<string>()
    for (const provider of this.providers.values()) {
      for (const item of provider.items()) {
        validateItem(item)
        if (ids.has(item.id)) throw new CommandPaletteDefinitionError(`duplicate command palette item id "${item.id}"`)
        ids.add(item.id)
        items.push(item)
      }
    }
    return items
  }

  search(query = ''): readonly CommandPaletteSearchResult[] {
    return rankCommandPaletteItems(this.listItems(), query)
  }
}

export function createCommandPaletteRegistry(providers: readonly CommandPaletteProvider[] = []): CommandPaletteRegistry {
  return new CommandPaletteRegistry(providers)
}

export function createCommandPaletteProvider(
  id: string,
  items: readonly CommandPaletteItem[] | (() => readonly CommandPaletteItem[]),
): CommandPaletteProvider {
  const provider: CommandPaletteProvider = {
    id,
    items: typeof items === 'function' ? items : () => items,
  }
  validateProvider(provider)
  return provider
}

function commandCanExecuteWithoutInput(definition: CommandDefinition): boolean {
  return (definition.arguments ?? []).every((argument) => !argument.required || argument.default !== undefined)
}

export function createCommandRegistryPaletteProvider(
  commands: CommandRegistry,
  navigator: WidgetNavigator,
  providerId = 'commands',
): CommandPaletteProvider {
  return createCommandPaletteProvider(providerId, () => commands.list().map((definition) => ({
    id: `${providerId}:${definition.name}`,
    label: definition.name,
    category: 'Commands',
    keywords: [...(definition.aliases ?? []), definition.widgetId],
    disabled: !commandCanExecuteWithoutInput(definition),
    execute: () => navigator.navigate(commands.parse(definition.name)),
  })))
}

function widgetDefaults(manifest: WidgetManifest): Record<string, unknown> {
  const parameters: Record<string, unknown> = {}
  for (const [name, definition] of Object.entries(manifest.parameters ?? {})) {
    if (definition.default !== undefined) parameters[name] = definition.default
  }
  return parameters
}

export function createWidgetRegistryPaletteProvider(
  registry: WidgetRegistry,
  navigator: WidgetNavigator,
  providerId = 'widgets',
): CommandPaletteProvider {
  return createCommandPaletteProvider(providerId, () => registry.list().map((manifest) => {
    const parameters = widgetDefaults(manifest)
    const validation = registry.validate(manifest.id, parameters)
    return {
      id: `${providerId}:${manifest.id}`,
      label: manifest.title,
      category: 'Widgets',
      keywords: [manifest.id],
      disabled: !validation.valid,
      execute: () => navigator.navigate({ widgetId: manifest.id, parameters }),
    }
  }))
}

export interface WidgetActionPaletteProviderOptions {
  readonly providerId?: string
  readonly category?: string
  readonly instanceLabel?: string
}

export function createWidgetActionPaletteProvider(
  bindings: readonly WidgetActionBinding[] | (() => readonly WidgetActionBinding[]),
  options: WidgetActionPaletteProviderOptions = {},
): CommandPaletteProvider {
  const providerId = options.providerId ?? 'widget-actions'
  const getBindings = typeof bindings === 'function' ? bindings : () => bindings
  return createCommandPaletteProvider(providerId, () => getBindings()
    .filter((binding) => binding.action.visible !== false)
    .map((binding) => ({
      id: `${providerId}:${binding.action.id}`,
      label: binding.action.label,
      category: options.category ?? 'Widget actions',
      keywords: [binding.action.id, binding.action.group ?? '', options.instanceLabel ?? ''].filter(Boolean),
      shortcut: binding.action.shortcut,
      icon: binding.action.icon,
      priority: binding.action.priority,
      disabled: binding.action.disabled,
      execute: binding.execute,
    })))
}
