import { shallowRef, type ShallowRef } from 'vue'

export interface MutationDefinition<Input = unknown, Result = unknown> {
  readonly id: string
  readonly __inputType?: Input
  readonly __resultType?: Result
}

export type MutationInvocationContext = Readonly<{
  signal?: AbortSignal
  metadata?: Readonly<Record<string, unknown>>
}>

export type MutationErrorKind = 'transport' | 'server' | 'unknown'

export interface MutationErrorOptions {
  readonly code?: string
  readonly details?: unknown
  readonly cause?: unknown
}

export class InvalidMutationDefinitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidMutationDefinitionError'
  }
}

export class MutationError extends Error {
  readonly kind: MutationErrorKind
  readonly code: string | undefined
  readonly details: unknown
  override readonly cause: unknown

  constructor(kind: MutationErrorKind, message: string, options: MutationErrorOptions = {}) {
    super(message)
    this.name = 'MutationError'
    this.kind = kind
    this.code = options.code
    this.details = options.details
    this.cause = options.cause
  }
}

export type MutationState<Result> =
  | { readonly status: 'idle'; readonly result: null; readonly error: null }
  | { readonly status: 'pending'; readonly result: null; readonly error: null }
  | { readonly status: 'success'; readonly result: Result; readonly error: null }
  | { readonly status: 'error'; readonly result: null; readonly error: MutationError }

export type MutationStateRef<Result> = Readonly<ShallowRef<MutationState<Result>>>
export type MutationUnsubscribe = () => void

export interface MutationProvider {
  execute<Input, Result>(
    definition: MutationDefinition<Input, Result>,
    input: Input,
    context?: MutationInvocationContext,
  ): Promise<Result>
}

export interface MutationHandle<Input, Result> {
  readonly definition: MutationDefinition<Input, Result>
  readonly state: MutationStateRef<Result>
  execute(input: Input, context?: MutationInvocationContext): Promise<Result>
  reset(): void
  release(): void
}

export interface MutationHandleDiagnostic {
  readonly mutationId: string
  readonly invocationId: number | null
  readonly status: MutationState<unknown>['status']
  readonly pendingInvocations: number
}

export interface MutationClientDiagnostics {
  readonly handles: readonly MutationHandleDiagnostic[]
  readonly activeInvocations: number
  readonly totalHandles: number
}

export type MutationClientDiagnosticsListener = (diagnostics: MutationClientDiagnostics) => void

interface MutationHandleRecord {
  readonly definition: MutationDefinition<unknown, unknown>
  readonly state: ShallowRef<MutationState<unknown>>
  pendingInvocations: number
  latestInvocationId: number | null
  released: boolean
}

function normalizeMutationDefinition<Input, Result>(
  definition: MutationDefinition<Input, Result>,
): MutationDefinition<Input, Result> {
  const id = typeof definition?.id === 'string' ? definition.id.trim() : ''
  if (!id) throw new InvalidMutationDefinitionError('mutation definition id must not be empty')
  return Object.freeze({ id })
}

export function createMutationDefinition<Input, Result>(id: string): MutationDefinition<Input, Result> {
  const normalizedId = typeof id === 'string' ? id.trim() : ''
  if (!normalizedId) throw new InvalidMutationDefinitionError('mutation definition id must not be empty')
  return Object.freeze({ id: normalizedId })
}

export function mutationDefinitionId(definition: MutationDefinition): string {
  return normalizeMutationDefinition(definition).id
}

export function normalizeMutationError(error: unknown): MutationError {
  if (error instanceof MutationError) return error

  if (error instanceof Error) {
    return new MutationError('unknown', error.message, { cause: error })
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      kind?: unknown
      message?: unknown
      code?: unknown
      details?: unknown
      cause?: unknown
    }
    const kind = candidate.kind
    if (kind === 'transport' || kind === 'server' || kind === 'unknown') {
      return new MutationError(
        kind,
        typeof candidate.message === 'string' && candidate.message ? candidate.message : 'Mutation failed',
        {
          ...(typeof candidate.code === 'string' ? { code: candidate.code } : {}),
          ...(Object.prototype.hasOwnProperty.call(candidate, 'details') ? { details: candidate.details } : {}),
          ...(Object.prototype.hasOwnProperty.call(candidate, 'cause') ? { cause: candidate.cause } : {}),
        },
      )
    }
  }

  return new MutationError('unknown', String(error), { cause: error })
}

const idleMutationState = (): MutationState<unknown> => ({ status: 'idle', result: null, error: null })

export class MutationClient {
  private readonly handles = new Set<MutationHandleRecord>()
  private readonly diagnosticsListeners = new Set<MutationClientDiagnosticsListener>()
  private invocationSequence = 0

  constructor(private readonly provider: MutationProvider) {}

  execute<Input, Result>(
    definition: MutationDefinition<Input, Result>,
    input: Input,
    context?: MutationInvocationContext,
  ): Promise<Result> {
    const normalizedDefinition = normalizeMutationDefinition(definition)
    return this.executeProvider(normalizedDefinition, input, context)
  }

  createHandle<Input, Result>(definition: MutationDefinition<Input, Result>): MutationHandle<Input, Result> {
    const normalizedDefinition = normalizeMutationDefinition(definition)
    const record: MutationHandleRecord = {
      definition: normalizedDefinition as MutationDefinition<unknown, unknown>,
      state: shallowRef<MutationState<unknown>>(idleMutationState()),
      pendingInvocations: 0,
      latestInvocationId: null,
      released: false,
    }
    this.handles.add(record)
    this.emitDiagnostics()

    return {
      definition: normalizedDefinition,
      state: record.state as MutationStateRef<Result>,
      execute: (input, context) => this.executeHandle(record, normalizedDefinition, input, context),
      reset: () => this.resetHandle(record),
      release: () => this.releaseHandle(record),
    }
  }

  diagnostics(): MutationClientDiagnostics {
    const handles = [...this.handles]
      .map((handle): MutationHandleDiagnostic => ({
        mutationId: handle.definition.id,
        invocationId: handle.latestInvocationId,
        status: handle.state.value.status,
        pendingInvocations: handle.pendingInvocations,
      }))
      .sort((left, right) => {
        const mutationOrder = left.mutationId.localeCompare(right.mutationId)
        if (mutationOrder !== 0) return mutationOrder
        return (left.invocationId ?? 0) - (right.invocationId ?? 0)
      })

    return Object.freeze({
      handles: Object.freeze(handles),
      activeInvocations: handles.reduce((total, handle) => total + handle.pendingInvocations, 0),
      totalHandles: handles.length,
    })
  }

  subscribeDiagnostics(listener: MutationClientDiagnosticsListener): MutationUnsubscribe {
    this.diagnosticsListeners.add(listener)
    return () => this.diagnosticsListeners.delete(listener)
  }

  private executeHandle<Input, Result>(
    record: MutationHandleRecord,
    definition: MutationDefinition<Input, Result>,
    input: Input,
    context?: MutationInvocationContext,
  ): Promise<Result> {
    if (record.released) {
      return Promise.reject(new MutationError('unknown', 'Mutation handle has been released'))
    }

    const invocationId = ++this.invocationSequence
    record.latestInvocationId = invocationId
    record.pendingInvocations += 1
    record.state.value = { status: 'pending', result: null, error: null }
    this.emitDiagnostics()

    return this.executeProvider(definition, input, context).then(
      (result) => {
        record.pendingInvocations = Math.max(0, record.pendingInvocations - 1)
        if (!record.released && record.latestInvocationId === invocationId) {
          record.state.value = { status: 'success', result, error: null }
        }
        this.emitDiagnostics()
        return result
      },
      (error: unknown) => {
        record.pendingInvocations = Math.max(0, record.pendingInvocations - 1)
        const normalizedError = normalizeMutationError(error)
        if (!record.released && record.latestInvocationId === invocationId) {
          record.state.value = { status: 'error', result: null, error: normalizedError }
        }
        this.emitDiagnostics()
        return Promise.reject(normalizedError)
      },
    )
  }

  private executeProvider<Input, Result>(
    definition: MutationDefinition<Input, Result>,
    input: Input,
    context?: MutationInvocationContext,
  ): Promise<Result> {
    return Promise.resolve().then(() => this.provider.execute(definition, input, context)).catch((error: unknown) => {
      return Promise.reject(normalizeMutationError(error))
    })
  }

  private resetHandle(record: MutationHandleRecord): void {
    if (record.released) return
    record.latestInvocationId = null
    record.state.value = idleMutationState()
    this.emitDiagnostics()
  }

  private releaseHandle(record: MutationHandleRecord): void {
    if (record.released) return
    record.released = true
    record.latestInvocationId = null
    this.handles.delete(record)
    this.emitDiagnostics()
  }

  private emitDiagnostics(): void {
    if (this.diagnosticsListeners.size === 0) return
    const snapshot = this.diagnostics()
    for (const listener of [...this.diagnosticsListeners]) listener(snapshot)
  }
}

export function createMutationClient(provider: MutationProvider): MutationClient {
  return new MutationClient(provider)
}
