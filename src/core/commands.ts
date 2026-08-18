import type { NavigationIntent } from './navigation'
import type { WidgetId } from './widget'

export type CommandArgumentType = 'string' | 'number' | 'boolean'

export interface CommandArgumentDefinition {
  readonly name: string
  readonly type: CommandArgumentType
  readonly required?: boolean
  readonly default?: string | number | boolean
}

export interface CommandDefinition {
  readonly name: string
  readonly aliases?: readonly string[]
  readonly widgetId: WidgetId
  readonly arguments?: readonly CommandArgumentDefinition[]
  readonly parameters?: Readonly<Record<string, unknown>>
}

export type CommandParseErrorCode =
  | 'empty-input'
  | 'unknown-command'
  | 'unterminated-quote'
  | 'missing-argument'
  | 'too-many-arguments'
  | 'invalid-argument'

export class CommandParseError extends Error {
  constructor(
    public readonly code: CommandParseErrorCode,
    message: string,
    public readonly commandName?: string,
    public readonly argumentName?: string,
  ) {
    super(message)
    this.name = 'CommandParseError'
  }
}

export class CommandDefinitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CommandDefinitionError'
  }
}

const commandNamePattern = /^[a-z][a-z0-9-]*$/

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

function validateArgument(definition: CommandArgumentDefinition): void {
  if (!definition.name.trim()) throw new CommandDefinitionError('command argument name must not be empty')
  if (definition.default !== undefined && typeof definition.default !== definition.type) {
    throw new CommandDefinitionError(`default value for command argument "${definition.name}" must be a ${definition.type}`)
  }
  if (definition.required && definition.default !== undefined) {
    throw new CommandDefinitionError(`required command argument "${definition.name}" must not define a default value`)
  }
}

function validateDefinition(definition: CommandDefinition): void {
  const name = normalizeName(definition.name)
  if (!commandNamePattern.test(name)) {
    throw new CommandDefinitionError('command name must start with a letter and contain only lowercase letters, numbers or hyphens')
  }

  const aliases = definition.aliases ?? []
  for (const alias of aliases) {
    const normalized = normalizeName(alias)
    if (!commandNamePattern.test(normalized)) {
      throw new CommandDefinitionError(`invalid command alias "${alias}"`)
    }
  }

  const argumentsList = definition.arguments ?? []
  const names = new Set<string>()
  let optionalSeen = false
  for (const argument of argumentsList) {
    validateArgument(argument)
    if (names.has(argument.name)) throw new CommandDefinitionError(`duplicate command argument "${argument.name}"`)
    names.add(argument.name)

    const optional = !argument.required || argument.default !== undefined
    if (optional) optionalSeen = true
    if (optionalSeen && argument.required) {
      throw new CommandDefinitionError('required command arguments must come before optional arguments')
    }
  }
}

function tokenize(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let escaping = false

  const pushCurrent = (): void => {
    if (current.length > 0) {
      tokens.push(current)
      current = ''
    }
  }

  for (const character of input.trim()) {
    if (escaping) {
      current += character
      escaping = false
      continue
    }

    if (character === '\\') {
      escaping = true
      continue
    }

    if (quote) {
      if (character === quote) quote = null
      else current += character
      continue
    }

    if (character === '"' || character === "'") {
      quote = character
      continue
    }

    if (/\s/.test(character)) pushCurrent()
    else current += character
  }

  if (escaping) current += '\\'
  if (quote) throw new CommandParseError('unterminated-quote', 'unterminated quoted command argument')
  pushCurrent()
  return tokens
}

function parseBoolean(value: string): boolean | null {
  switch (value.toLowerCase()) {
    case 'true':
    case 'yes':
    case 'on':
    case '1':
      return true
    case 'false':
    case 'no':
    case 'off':
    case '0':
      return false
    default:
      return null
  }
}

function convertArgument(value: string, definition: CommandArgumentDefinition, commandName: string): unknown {
  if (definition.type === 'string') return value

  if (definition.type === 'number') {
    const converted = Number(value)
    if (Number.isFinite(converted)) return converted
  } else {
    const converted = parseBoolean(value)
    if (converted !== null) return converted
  }

  throw new CommandParseError(
    'invalid-argument',
    `invalid ${definition.type} value for argument "${definition.name}"`,
    commandName,
    definition.name,
  )
}

export class CommandRegistry {
  private readonly definitions = new Map<string, CommandDefinition>()
  private readonly lookup = new Map<string, string>()

  constructor(definitions: readonly CommandDefinition[] = []) {
    for (const definition of definitions) this.register(definition)
  }

  register(definition: CommandDefinition): void {
    validateDefinition(definition)
    const name = normalizeName(definition.name)
    const names = [name, ...(definition.aliases ?? []).map(normalizeName)]
    const localNames = new Set<string>()

    for (const candidate of names) {
      if (localNames.has(candidate)) {
        throw new CommandDefinitionError(`command name or alias "${candidate}" is duplicated in the definition`)
      }
      localNames.add(candidate)

      if (this.lookup.has(candidate)) {
        throw new CommandDefinitionError(`command name or alias "${candidate}" is already registered`)
      }
    }

    const stored: CommandDefinition = {
      ...definition,
      name,
      aliases: (definition.aliases ?? []).map(normalizeName),
      arguments: (definition.arguments ?? []).map((argument) => ({ ...argument })),
      parameters: { ...(definition.parameters ?? {}) },
    }
    this.definitions.set(name, stored)
    for (const candidate of names) this.lookup.set(candidate, name)
  }

  get(nameOrAlias: string): CommandDefinition | undefined {
    const canonical = this.lookup.get(normalizeName(nameOrAlias))
    if (!canonical) return undefined
    return this.definitions.get(canonical)
  }

  list(): readonly CommandDefinition[] {
    return [...this.definitions.values()].map((definition) => ({
      ...definition,
      aliases: [...(definition.aliases ?? [])],
      arguments: (definition.arguments ?? []).map((argument) => ({ ...argument })),
      parameters: { ...(definition.parameters ?? {}) },
    }))
  }

  parse(input: string): NavigationIntent {
    const tokens = tokenize(input)
    if (tokens.length === 0) throw new CommandParseError('empty-input', 'command input must not be empty')

    const requestedName = tokens[0] ?? ''
    const definition = this.get(requestedName)
    if (!definition) {
      throw new CommandParseError('unknown-command', `unknown command "${requestedName}"`, requestedName)
    }

    const values = tokens.slice(1)
    const argumentsList = definition.arguments ?? []
    if (values.length > argumentsList.length) {
      throw new CommandParseError('too-many-arguments', `too many arguments for command "${definition.name}"`, definition.name)
    }

    const parameters: Record<string, unknown> = { ...(definition.parameters ?? {}) }
    for (let index = 0; index < argumentsList.length; index += 1) {
      const argument = argumentsList[index]
      if (!argument) continue
      const value = values[index]

      if (value === undefined) {
        if (argument.default !== undefined) parameters[argument.name] = argument.default
        else if (argument.required) {
          throw new CommandParseError(
            'missing-argument',
            `missing required argument "${argument.name}" for command "${definition.name}"`,
            definition.name,
            argument.name,
          )
        }
        continue
      }

      parameters[argument.name] = convertArgument(value, argument, definition.name)
    }

    return { widgetId: definition.widgetId, parameters }
  }
}

export function createCommandRegistry(definitions: readonly CommandDefinition[] = []): CommandRegistry {
  return new CommandRegistry(definitions)
}
