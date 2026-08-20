import { describe, expect, it, vi } from 'vitest'
import {
  createMutationClient,
  createMutationDefinition,
  InvalidMutationDefinitionError,
  MutationError,
  type MutationDefinition,
  type MutationProvider,
} from '../src/data/mutation-client'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

describe('MutationClient', () => {
  it('creates immutable, typed mutation definitions and validates their ids', () => {
    const definition = createMutationDefinition<{ value: number }, { accepted: boolean }>('  demo.mutate  ')

    expect(definition).toEqual({ id: 'demo.mutate' })
    expect(Object.isFrozen(definition)).toBe(true)
    expect(() => createMutationDefinition('   ')).toThrow(InvalidMutationDefinitionError)
    expect(() => createMutationDefinition('')).toThrow('mutation definition id must not be empty')
  })

  it('executes a provider without deduplicating explicit calls and forwards input/context', async () => {
    const execute: MutationProvider['execute'] = async <Input, Result>(
      _definition: MutationDefinition<Input, Result>,
      input: Input,
    ) => ({ input } as unknown as Result)
    const provider = { execute: vi.fn(execute) } as unknown as MutationProvider
    const client = createMutationClient(provider)
    const definition = createMutationDefinition<{ orderId: string }, { input: { orderId: string } }>('order.place')
    const context = { metadata: { source: 'test' } }
    const handle = client.createHandle(definition)

    const first = await handle.execute({ orderId: 'one' }, context)
    const second = await handle.execute({ orderId: 'one' }, context)

    expect(first).toEqual({ input: { orderId: 'one' } })
    expect(second).toEqual({ input: { orderId: 'one' } })
    expect(provider.execute).toHaveBeenCalledTimes(2)
    expect(provider.execute).toHaveBeenNthCalledWith(1, definition, { orderId: 'one' }, context)
    expect(provider.execute).toHaveBeenNthCalledWith(2, definition, { orderId: 'one' }, context)
  })

  it('exposes idle, pending and success state with inferred result types', async () => {
    const response = deferred<{ accepted: boolean }>()
    const provider: MutationProvider = {
      execute: <Input, Result>(definition: MutationDefinition<Input, Result>) => {
        void definition
        return response.promise as unknown as Promise<Result>
      },
    }
    const definition = createMutationDefinition<{ orderId: string }, { accepted: boolean }>('order.place')
    const handle = createMutationClient(provider).createHandle(definition)

    expect(handle.state.value).toEqual({ status: 'idle', result: null, error: null })
    const resultPromise = handle.execute({ orderId: 'one' })
    expect(handle.state.value).toEqual({ status: 'pending', result: null, error: null })

    response.resolve({ accepted: true })
    const result: boolean = (await resultPromise).accepted

    expect(result).toBe(true)
    expect(handle.state.value).toEqual({ status: 'success', result: { accepted: true }, error: null })

    // @ts-expect-error Input is inferred from the mutation definition.
    handle.execute({ wrong: true })
  })

  it('normalizes synchronous throws and promise rejections into MutationError', async () => {
    const syncClient = createMutationClient({
      execute: () => {
        throw new Error('connection failed')
      },
    })
    const syncHandle = syncClient.createHandle(createMutationDefinition('order.place'))
    const syncPromise = syncHandle.execute({})

    await expect(syncPromise).rejects.toMatchObject({ kind: 'unknown', message: 'connection failed' })
    expect(syncHandle.state.value.status).toBe('error')
    expect(syncHandle.state.value.error).toBeInstanceOf(MutationError)

    const rejectedClient = createMutationClient({
      execute: async () => {
        throw new MutationError('server', 'Order rejected', { code: 'ORDER_REJECTED', details: { reason: 'busy' } })
      },
    })
    const rejectedHandle = rejectedClient.createHandle(createMutationDefinition('order.place'))

    await expect(rejectedHandle.execute({})).rejects.toMatchObject({
      kind: 'server',
      code: 'ORDER_REJECTED',
      details: { reason: 'busy' },
    })
    expect(rejectedHandle.state.value.status).toBe('error')
  })

  it('keeps concurrent invocations independent while the latest invocation owns visible state', async () => {
    const requests: Array<ReturnType<typeof deferred<{ accepted: boolean }>>> = []
    const provider: MutationProvider = {
      execute: <Input, Result>(definition: MutationDefinition<Input, Result>) => {
        void definition
        const request = deferred<{ accepted: boolean }>()
        requests.push(request)
        return request.promise as unknown as Promise<Result>
      },
    }
    const handle = createMutationClient(provider).createHandle(
      createMutationDefinition<{ orderId: string }, { accepted: boolean }>('order.place'),
    )

    const first = handle.execute({ orderId: 'first' })
    const second = handle.execute({ orderId: 'second' })
    expect(handle.state.value.status).toBe('pending')
    await Promise.resolve()

    requests[1]?.resolve({ accepted: true })
    await expect(second).resolves.toEqual({ accepted: true })
    expect(handle.state.value).toEqual({ status: 'success', result: { accepted: true }, error: null })

    requests[0]?.resolve({ accepted: false })
    await expect(first).resolves.toEqual({ accepted: false })
    expect(handle.state.value).toEqual({ status: 'success', result: { accepted: true }, error: null })
  })

  it('reset returns to idle and prevents a late invocation from changing the state', async () => {
    const request = deferred<string>()
    const handle = createMutationClient({
      execute: <Input, Result>(definition: MutationDefinition<Input, Result>) => {
        void definition
        return request.promise as unknown as Promise<Result>
      },
    }).createHandle(
      createMutationDefinition<Record<string, never>, string>('demo.reset'),
    )

    const pending = handle.execute({})
    handle.reset()
    expect(handle.state.value).toEqual({ status: 'idle', result: null, error: null })

    request.resolve('late result')
    await expect(pending).resolves.toBe('late result')
    expect(handle.state.value).toEqual({ status: 'idle', result: null, error: null })
  })

  it('isolates handles and clients and exposes pending diagnostics', async () => {
    const firstRequest = deferred<string>()
    const secondRequest = deferred<string>()
    let call = 0
    const provider: MutationProvider = {
      execute: <Input, Result>(definition: MutationDefinition<Input, Result>) => {
        void definition
        call += 1
        return (call === 1 ? firstRequest.promise : secondRequest.promise) as unknown as Promise<Result>
      },
    }
    const client = createMutationClient(provider)
    const definition = createMutationDefinition<Record<string, never>, string>('demo.shared')
    const firstHandle = client.createHandle(definition)
    const secondHandle = client.createHandle(definition)
    const diagnostics = vi.fn()
    client.subscribeDiagnostics(diagnostics)

    const first = firstHandle.execute({})
    await Promise.resolve()
    expect(firstHandle.state.value.status).toBe('pending')
    expect(secondHandle.state.value.status).toBe('idle')
    expect(client.diagnostics()).toMatchObject({ activeInvocations: 1, totalHandles: 2 })
    expect(client.diagnostics().handles.find((handle) => handle.pendingInvocations > 0)?.pendingInvocations).toBe(1)

    firstRequest.resolve('done')
    await expect(first).resolves.toBe('done')
    expect(client.diagnostics()).toMatchObject({ activeInvocations: 0, totalHandles: 2 })
    expect(diagnostics).toHaveBeenCalled()

    secondHandle.release()
    expect(client.diagnostics().totalHandles).toBe(1)

    const otherClient = createMutationClient(provider)
    expect(otherClient.diagnostics().totalHandles).toBe(0)
  })

  it('does not retry when the provider rejects', async () => {
    const execute = vi.fn(async () => {
      throw new MutationError('transport', 'disconnected')
    })
    const handle = createMutationClient({ execute }).createHandle(createMutationDefinition('demo.no-retry'))

    await expect(handle.execute({})).rejects.toMatchObject({ kind: 'transport' })
    expect(execute).toHaveBeenCalledTimes(1)
  })
})
