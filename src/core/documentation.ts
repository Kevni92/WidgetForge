import type { CommandDefinition } from './commands'
import type { WidgetId, WidgetManifest, WidgetParameterDefinition } from './widget'

export type DocumentationScalar = string | number | boolean

export interface DocumentationMetadata {
  readonly summary?: string
  readonly details?: string
  readonly examples?: readonly string[]
}

export interface WidgetParameterDocumentation {
  readonly name: string
  readonly type: WidgetParameterDefinition['type']
  readonly required: boolean
  readonly default?: DocumentationScalar
  readonly description?: string
  readonly example?: DocumentationScalar
}

export interface WidgetDocumentationView {
  readonly kind: 'widget'
  readonly id: WidgetId
  readonly title: string
  readonly description?: string
  readonly summary?: string
  readonly details?: string
  readonly examples: readonly string[]
  readonly parameters: readonly WidgetParameterDocumentation[]
}

export interface CommandArgumentDocumentation {
  readonly name: string
  readonly type: 'string' | 'number' | 'boolean'
  readonly required: boolean
  readonly default?: DocumentationScalar
  readonly description?: string
  readonly example?: DocumentationScalar
}

export interface CommandDocumentationView {
  readonly kind: 'command'
  readonly name: string
  readonly aliases: readonly string[]
  readonly widgetId: WidgetId
  readonly description?: string
  readonly summary?: string
  readonly details?: string
  readonly category?: string
  readonly examples: readonly string[]
  readonly usage: string
  readonly arguments: readonly CommandArgumentDocumentation[]
}

export function cloneDocumentationMetadata(metadata: DocumentationMetadata): DocumentationMetadata
export function cloneDocumentationMetadata(metadata: undefined): undefined
export function cloneDocumentationMetadata(metadata?: DocumentationMetadata): DocumentationMetadata | undefined {
  if (!metadata) return undefined
  return {
    ...(metadata.summary !== undefined ? { summary: metadata.summary } : {}),
    ...(metadata.details !== undefined ? { details: metadata.details } : {}),
    ...(metadata.examples !== undefined ? { examples: [...metadata.examples] } : {}),
  }
}

export function validateDocumentationMetadata(metadata: DocumentationMetadata | undefined, label: string): void {
  if (!metadata) return
  for (const field of ['summary', 'details'] as const) {
    const value = metadata[field]
    if (value !== undefined && !value.trim()) throw new Error(`${label}.${field} must not be empty`)
  }
  for (const [index, example] of (metadata.examples ?? []).entries()) {
    if (!example.trim()) throw new Error(`${label}.examples[${index}] must not be empty`)
  }
}

function parameterDocumentation(name: string, definition: WidgetParameterDefinition): WidgetParameterDocumentation {
  return {
    name,
    type: definition.type,
    required: definition.required === true,
    ...(definition.default !== undefined ? { default: definition.default } : {}),
    ...(definition.description !== undefined ? { description: definition.description } : {}),
    ...(definition.example !== undefined ? { example: definition.example } : {}),
  }
}

export function createWidgetDocumentationView(manifest: WidgetManifest): WidgetDocumentationView {
  const documentation = manifest.documentation
  return {
    kind: 'widget',
    id: manifest.id,
    title: manifest.title,
    ...(manifest.description !== undefined ? { description: manifest.description } : {}),
    ...(documentation?.summary !== undefined ? { summary: documentation.summary } : {}),
    ...(documentation?.details !== undefined ? { details: documentation.details } : {}),
    examples: [...(documentation?.examples ?? [])],
    parameters: Object.entries(manifest.parameters ?? {}).map(([name, definition]) => parameterDocumentation(name, definition)),
  }
}

export function createCommandDocumentationView(definition: CommandDefinition): CommandDocumentationView {
  const argumentsList = definition.arguments ?? []
  const argumentNames = argumentsList.map((argument) => argument.required ? `<${argument.name}>` : `[${argument.name}]`)
  const examples = definition.examples ?? definition.documentation?.examples ?? []
  return {
    kind: 'command',
    name: definition.name,
    aliases: [...(definition.aliases ?? [])],
    widgetId: definition.widgetId,
    ...(definition.description !== undefined ? { description: definition.description } : {}),
    ...(definition.documentation?.summary !== undefined ? { summary: definition.documentation.summary } : {}),
    ...(definition.documentation?.details !== undefined ? { details: definition.documentation.details } : {}),
    ...(definition.category !== undefined ? { category: definition.category } : {}),
    examples: [...examples],
    usage: [definition.name, ...argumentNames].join(' '),
    arguments: argumentsList.map((argument) => ({
      name: argument.name,
      type: argument.type,
      required: argument.required === true,
      ...(argument.default !== undefined ? { default: argument.default } : {}),
      ...(argument.description !== undefined ? { description: argument.description } : {}),
      ...(argument.example !== undefined ? { example: argument.example } : {}),
    })),
  }
}
