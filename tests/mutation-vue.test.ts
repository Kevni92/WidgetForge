import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import {
  createMutationClient,
  createMutationDefinition,
  MutationClientProvider,
  MutationClientUnavailableError,
  useMutation,
  useMutationClient,
  type MutationBinding,
  type MutationDefinition,
  type MutationInvocationContext,
  type MutationProvider,
} from '../src/index'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function createProvider<Result>(executeInput: (input: unknown, context?: MutationInvocationContext) => Promise<Result>): MutationProvider {
  return {
    execute: <Input, ResultType>(
      definition: MutationDefinition<Input, ResultType>,
      input: Input,
      context?: MutationInvocationContext,
    ) => {
      void definition
      return executeInput(input, context) as unknown as Promise<ResultType>
    },
  }
}

describe('Mutation Vue integration', () => {
  it('provides the nearest client and keeps independent provider scopes', () => {
    const outerClient = createMutationClient(createProvider(async () => 'outer'))
    const innerClient = createMutationClient(createProvider(async () => 'inner'))
    let injectedClient!: ReturnType<typeof createMutationClient>

    const Consumer = defineComponent({
      setup() {
        injectedClient = useMutationClient()
        return () => h('span', 'consumer')
      },
    })
    const Root = defineComponent({
      setup() {
        return () => h(
          MutationClientProvider,
          { client: outerClient },
          {
            default: () => h(
              MutationClientProvider,
              { client: innerClient },
              { default: () => h(Consumer) },
            ),
          },
        )
      },
    })

    const wrapper = mount(Root)

    expect(wrapper.text()).toBe('consumer')
    expect(injectedClient).toBe(innerClient)
  })

  it('throws a clear error when a mutation client provider is missing', () => {
    const Consumer = defineComponent({
      setup() {
        useMutationClient()
        return () => h('span')
      },
    })

    expect(() => mount(Consumer)).toThrow(MutationClientUnavailableError)
  })

  it('binds reactive state, typed execution and reset to the component lifecycle', async () => {
    const response = deferred<{ accepted: boolean }>()
    const client = createMutationClient(createProvider(async () => response.promise))
    const definition = createMutationDefinition<{ orderId: string }, { accepted: boolean }>('order.place')
    let mutation!: MutationBinding<{ orderId: string }, { accepted: boolean }>

    const Consumer = defineComponent({
      setup() {
        mutation = useMutation(definition)
        return () => h('span', mutation.state.value.status)
      },
    })
    const Root = defineComponent({
      setup() {
        return () => h(MutationClientProvider, { client }, { default: () => h(Consumer) })
      },
    })
    const wrapper = mount(Root)

    expect(wrapper.text()).toBe('idle')
    const resultPromise = mutation.execute({ orderId: 'one' })
    expect(mutation.state.value.status).toBe('pending')
    await nextTick()
    expect(wrapper.text()).toBe('pending')

    response.resolve({ accepted: true })
    const result: boolean = (await resultPromise).accepted
    await nextTick()

    expect(result).toBe(true)
    expect(wrapper.text()).toBe('success')
    mutation.reset()
    await nextTick()
    expect(wrapper.text()).toBe('idle')

    // @ts-expect-error Input is inferred from the mutation definition.
    mutation.execute({ wrong: true })
  })

  it('exposes provider errors as reactive error state while the promise rejects', async () => {
    const client = createMutationClient(createProvider(async () => {
      throw new Error('mutation failed')
    }))
    const definition = createMutationDefinition<Record<string, never>, string>('demo.failure')
    let mutation!: MutationBinding<Record<string, never>, string>
    const Consumer = defineComponent({
      setup() {
        mutation = useMutation(definition)
        return () => h('span', mutation.state.value.error?.message ?? mutation.state.value.status)
      },
    })
    const wrapper = mount(defineComponent({
      setup() {
        return () => h(MutationClientProvider, { client }, { default: () => h(Consumer) })
      },
    }))

    await expect(mutation.execute({})).rejects.toMatchObject({ message: 'mutation failed' })
    await nextTick()

    expect(mutation.state.value.status).toBe('error')
    expect(wrapper.text()).toBe('mutation failed')
  })

  it('keeps handles isolated and does not execute again on remount', async () => {
    const requests: Array<ReturnType<typeof deferred<string>>> = []
    const executeCalls: unknown[] = []
    const client = createMutationClient(createProvider(async (input) => {
      executeCalls.push(input)
      const request = deferred<string>()
      requests.push(request)
      return request.promise
    }))
    const definition = createMutationDefinition<Record<string, never>, string>('demo.shared')
    let firstMutation!: MutationBinding<Record<string, never>, string>
    let secondMutation!: MutationBinding<Record<string, never>, string>

    const First = defineComponent({
      setup() {
        firstMutation = useMutation(definition)
        return () => h('span', `first:${firstMutation.state.value.status}`)
      },
    })
    const Second = defineComponent({
      setup() {
        secondMutation = useMutation(definition)
        return () => h('span', `second:${secondMutation.state.value.status}`)
      },
    })
    const Consumer = defineComponent({
      setup() {
        return () => h('div', [h(First), h(Second)])
      },
    })
    const Root = defineComponent({
      setup() {
        return () => h(MutationClientProvider, { client }, { default: () => h(Consumer) })
      },
    })
    const wrapper = mount(Root)

    const first = firstMutation.execute({})
    const second = secondMutation.execute({})
    await nextTick()
    expect(firstMutation.state.value.status).toBe('pending')
    expect(secondMutation.state.value.status).toBe('pending')
    expect(executeCalls).toHaveLength(2)

    requests[1]?.resolve('second')
    await expect(second).resolves.toBe('second')
    expect(secondMutation.state.value.status).toBe('success')
    expect(firstMutation.state.value.status).toBe('pending')

    wrapper.unmount()
    requests[0]?.resolve('first')
    await expect(first).resolves.toBe('first')
    expect(firstMutation.state.value.status).toBe('pending')

    const remounted = mount(Root)
    expect(executeCalls).toHaveLength(2)
    remounted.unmount()
  })
})
