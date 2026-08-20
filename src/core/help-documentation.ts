import type { CommandDocumentationView, WidgetDocumentationView } from './documentation'

export type HelpReferenceFilter = 'all' | 'widgets' | 'commands'

export interface HelpWidgetReference {
  readonly kind: 'widget'
  readonly key: string
  readonly id: string
  readonly title: string
  readonly description?: string
  readonly parameterCount: number
  readonly commands: readonly CommandDocumentationView[]
  readonly documentation: WidgetDocumentationView
}

export interface HelpCommandReference {
  readonly kind: 'command'
  readonly key: string
  readonly name: string
  readonly widgetId: string
  readonly description?: string
  readonly documentation: CommandDocumentationView
}

export type HelpReferenceEntry = HelpWidgetReference | HelpCommandReference

export interface HelpDocumentationSnapshot {
  readonly widgets: readonly HelpWidgetReference[]
  readonly commands: readonly HelpCommandReference[]
  readonly entries: readonly HelpReferenceEntry[]
}

export interface HelpSearchResult {
  readonly entry: HelpReferenceEntry
  readonly score: number
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function compareLabels(left: { readonly id?: string; readonly name?: string; readonly title?: string }, right: typeof left): number {
  const leftLabel = normalized(left.title ?? left.name ?? left.id ?? '')
  const rightLabel = normalized(right.title ?? right.name ?? right.id ?? '')
  return leftLabel.localeCompare(rightLabel) || normalized(left.id ?? left.name ?? '').localeCompare(normalized(right.id ?? right.name ?? ''))
}

function compareCommands(left: CommandDocumentationView, right: CommandDocumentationView): number {
  return normalized(left.name).localeCompare(normalized(right.name))
}

function compareWidgets(left: WidgetDocumentationView, right: WidgetDocumentationView): number {
  return compareLabels({ id: left.id, title: left.title }, { id: right.id, title: right.title })
}

export function createHelpDocumentationSnapshot(
  widgets: readonly WidgetDocumentationView[],
  commands: readonly CommandDocumentationView[],
): HelpDocumentationSnapshot {
  const sortedCommands = [...commands].sort(compareCommands)
  const commandsByWidget = new Map<string, CommandDocumentationView[]>()
  for (const command of sortedCommands) {
    const matching = commandsByWidget.get(command.widgetId) ?? []
    matching.push(command)
    commandsByWidget.set(command.widgetId, matching)
  }

  const sortedWidgets = [...widgets].sort(compareWidgets)
  const widgetReferences = sortedWidgets.map<HelpWidgetReference>((documentation) => ({
    kind: 'widget',
    key: `widget:${documentation.id}`,
    id: documentation.id,
    title: documentation.title,
    ...(documentation.description !== undefined ? { description: documentation.description } : {}),
    parameterCount: documentation.parameters.length,
    commands: [...(commandsByWidget.get(documentation.id) ?? [])],
    documentation,
  }))
  const commandReferences = sortedCommands.map<HelpCommandReference>((documentation) => ({
    kind: 'command',
    key: `command:${documentation.name}`,
    name: documentation.name,
    widgetId: documentation.widgetId,
    ...(documentation.description !== undefined ? { description: documentation.description } : {}),
    documentation,
  }))

  return {
    widgets: widgetReferences,
    commands: commandReferences,
    entries: [...widgetReferences, ...commandReferences],
  }
}

function fieldsForEntry(entry: HelpReferenceEntry): readonly (readonly [string, number])[] {
  if (entry.kind === 'widget') {
    const documentation = entry.documentation
    return [
      [entry.id, 0],
      [entry.title, 4],
      [entry.description ?? '', 8],
      [documentation.summary ?? '', 10],
      [documentation.details ?? '', 12],
      ...documentation.examples.map((example) => [example, 16] as const),
      ...documentation.parameters.flatMap((parameter) => [
        [parameter.name, 2] as const,
        [parameter.type, 6] as const,
        [parameter.description ?? '', 14] as const,
        [parameter.example === undefined ? '' : String(parameter.example), 18] as const,
      ]),
      ...entry.commands.flatMap((command) => [
        [command.name, 1] as const,
        [command.usage, 3] as const,
        [command.description ?? '', 9] as const,
      ]),
    ]
  }

  const documentation = entry.documentation
  return [
    [entry.name, 0],
    [entry.widgetId, 3],
    [documentation.description ?? documentation.summary ?? '', 6],
    [documentation.category ?? '', 8],
    [documentation.usage, 2],
    ...documentation.aliases.map((alias) => [alias, 1] as const),
    ...documentation.examples.map((example) => [example, 12] as const),
    ...documentation.arguments.flatMap((argument) => [
      [argument.name, 2] as const,
      [argument.type, 5] as const,
      [argument.description ?? '', 10] as const,
      [argument.example === undefined ? '' : String(argument.example), 14] as const,
    ]),
  ]
}

function entryScore(entry: HelpReferenceEntry, query: string): number | null {
  const tokens = normalized(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0
  let score = 0
  const fields = fieldsForEntry(entry)
  for (const token of tokens) {
    let best = Number.POSITIVE_INFINITY
    for (const [value, weight] of fields) {
      const candidate = normalized(value)
      const index = candidate.indexOf(token)
      if (index < 0) continue
      best = Math.min(best, weight + index + (candidate === token ? 0 : 1))
    }
    if (!Number.isFinite(best)) return null
    score += best
  }
  return score
}

function compareResults(left: HelpSearchResult, right: HelpSearchResult): number {
  if (left.score !== right.score) return left.score - right.score
  if (left.entry.kind !== right.entry.kind) return left.entry.kind === 'widget' ? -1 : 1
  const leftLabel = left.entry.kind === 'widget' ? left.entry.title : left.entry.name
  const rightLabel = right.entry.kind === 'widget' ? right.entry.title : right.entry.name
  return normalized(leftLabel).localeCompare(normalized(rightLabel)) || left.entry.key.localeCompare(right.entry.key)
}

export function searchHelpDocumentation(
  snapshot: HelpDocumentationSnapshot,
  query = '',
  filter: HelpReferenceFilter = 'all',
): readonly HelpSearchResult[] {
  const entries = filter === 'widgets' ? snapshot.widgets : filter === 'commands' ? snapshot.commands : snapshot.entries
  return entries
    .map((entry) => ({ entry, score: entryScore(entry, query) }))
    .filter((result): result is HelpSearchResult => result.score !== null)
    .sort(compareResults)
}
