import type { Component } from 'vue'

export type WidgetId = string

export type WidgetParameterDefinition =
  | { type: 'string'; required?: boolean; default?: string }
  | { type: 'number'; required?: boolean; default?: number }
  | { type: 'boolean'; required?: boolean; default?: boolean }

export type WidgetParameterSchema = Record<string, WidgetParameterDefinition>

type WidgetParameterValue<TDefinition extends WidgetParameterDefinition> =
  TDefinition extends { type: 'string' }
    ? string
    : TDefinition extends { type: 'number' }
      ? number
      : boolean

type RequiredWidgetParameterKeys<TSchema extends WidgetParameterSchema> = {
  [TKey in keyof TSchema]-?: TSchema[TKey] extends { required: true } ? TKey : never
}[keyof TSchema]

type OptionalWidgetParameterKeys<TSchema extends WidgetParameterSchema> = Exclude<
  keyof TSchema,
  RequiredWidgetParameterKeys<TSchema>
>

export type InferWidgetParameters<TSchema extends WidgetParameterSchema> = {
  [TKey in RequiredWidgetParameterKeys<TSchema>]: WidgetParameterValue<TSchema[TKey]>
} & {
  [TKey in OptionalWidgetParameterKeys<TSchema>]?: WidgetParameterValue<TSchema[TKey]>
}

export interface WidgetSize {
  width: number
  height: number
}

export interface WidgetWindowMetadata {
  defaultSize?: WidgetSize
  minSize?: WidgetSize
  maxSize?: WidgetSize
  singleton?: boolean
}

export interface WidgetManifest<TSchema extends WidgetParameterSchema = WidgetParameterSchema> {
  id: WidgetId
  title: string
  component: Component
  parameters?: TSchema
  window?: WidgetWindowMetadata
}

export class WidgetDefinitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WidgetDefinitionError'
  }
}

const widgetIdPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/

function validateSize(name: string, size?: WidgetSize): void {
  if (!size) return

  if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) {
    throw new WidgetDefinitionError(`${name} must contain finite positive width and height values`)
  }
}

function validateWindowMetadata(window?: WidgetWindowMetadata): void {
  if (!window) return

  validateSize('window.defaultSize', window.defaultSize)
  validateSize('window.minSize', window.minSize)
  validateSize('window.maxSize', window.maxSize)

  const { defaultSize, minSize, maxSize } = window

  if (minSize && maxSize && (minSize.width > maxSize.width || minSize.height > maxSize.height)) {
    throw new WidgetDefinitionError('window.minSize must not exceed window.maxSize')
  }

  if (defaultSize && minSize && (defaultSize.width < minSize.width || defaultSize.height < minSize.height)) {
    throw new WidgetDefinitionError('window.defaultSize must not be smaller than window.minSize')
  }

  if (defaultSize && maxSize && (defaultSize.width > maxSize.width || defaultSize.height > maxSize.height)) {
    throw new WidgetDefinitionError('window.defaultSize must not exceed window.maxSize')
  }
}

function validateParameterSchema(parameters?: WidgetParameterSchema): void {
  if (!parameters) return

  for (const [name, definition] of Object.entries(parameters)) {
    if (!name.trim()) throw new WidgetDefinitionError('parameter names must not be empty')

    if ('default' in definition && definition.default !== undefined && typeof definition.default !== definition.type) {
      throw new WidgetDefinitionError(`default value for parameter "${name}" must be a ${definition.type}`)
    }
  }
}

export function defineWidget<const TSchema extends WidgetParameterSchema = WidgetParameterSchema>(
  manifest: WidgetManifest<TSchema>,
): WidgetManifest<TSchema> {
  if (!widgetIdPattern.test(manifest.id)) {
    throw new WidgetDefinitionError(
      'widget id must start with a lowercase letter and contain only lowercase letters, numbers, dots or hyphens',
    )
  }

  if (!manifest.title.trim()) throw new WidgetDefinitionError('widget title must not be empty')

  const componentType = typeof manifest.component
  if (componentType !== 'object' && componentType !== 'function') {
    throw new WidgetDefinitionError('widget component must be a Vue component')
  }

  validateParameterSchema(manifest.parameters)
  validateWindowMetadata(manifest.window)

  return manifest
}
