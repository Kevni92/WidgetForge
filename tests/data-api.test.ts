import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import {
  createDataClient,
  createDataKey,
  type DataObserver,
  type DataProvider,
} from '../src/data/data-client'
import DataClientProvider from '../src/vue/DataClientProvider.vue'
import { useData } from '../src/vue/data-context'

class TestProvider implements DataProvider {
  observer: DataObserver<unknown> | null = null
  unsubscribe = vi.fn()
  subscriptions = 0

  subscribe<T>(_key: ReturnType<typeof createDataKey<T>>, observer: DataObserver<T>): () => void {
    this.subscriptions += 1
    this.observer = observer as DataObserver<unknown>
    return this.unsubscribe
  }
}

describe('reactive data API', () => {
  it('starts loading and reacts to ready/error provider events', () => {
    const provider = new TestProvider()
    const client = createDataClient(provider)
    const handle = client.acquire(createDataKey<{ value: number }>('demo', 'one'))

    expect(handle.state.value).toEqual({ status: 'loading', data: null, error: null })

    provider.observer?.next({ value: 4 })
    expect(handle.state.value).toEqual({ status: 'ready', data: { value: 4 }, error: null })

    provider.observer?.error(new Error('offline'))
    expect(handle.state.value.status).toBe('error')
    expect(handle.state.value.data).toEqual({ value: 4 })
    expect(handle.state.value.error?.message).toBe('offline')
  })

  it('releases provider subscriptions exactly once and ignores late events', () => {
    const provider = new TestProvider()
    const handle = createDataClient(provider).acquire(createDataKey<number>('demo', 'counter'))

    handle.release()
    handle.release()
    provider.observer?.next(99)

    expect(provider.unsubscribe).toHaveBeenCalledTimes(1)
    expect(handle.state.value.status).toBe('loading')
  })

  it('turns synchronous provider failures into typed error state', () => {
    const provider: DataProvider = {
      subscribe: () => {
        throw new Error('provider failed')
      },
    }

    const handle = createDataClient(provider).acquire(createDataKey<string>('demo', 'error'))

    expect(handle.state.value.status).toBe('error')
    expect(handle.state.value.error?.message).toBe('provider failed')
  })

  it('useData releases its handle when the Vue consumer unmounts', async () => {
    const provider = new TestProvider()
    const client = createDataClient(provider)
    const key = createDataKey<string>('demo', 'vue')

    const Consumer = defineComponent({
      setup() {
        const state = useData(key)
        return () => h('span', state.value.status === 'ready' ? state.value.data : state.value.status)
      },
    })

    const Root = defineComponent({
      setup() {
        return () => h(DataClientProvider, { client }, { default: () => h(Consumer) })
      },
    })

    const wrapper = mount(Root)
    expect(wrapper.text()).toBe('loading')

    provider.observer?.next('ready-value')
    await nextTick()
    expect(wrapper.text()).toBe('ready-value')

    wrapper.unmount()
    expect(provider.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
