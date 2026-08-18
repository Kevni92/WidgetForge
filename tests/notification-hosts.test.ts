import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import NotificationCenter from '../src/vue/NotificationCenter.vue'
import NotificationToastHost from '../src/vue/NotificationToastHost.vue'
import { createNotificationStore } from '../src/core/notifications'
import type { WidgetNavigator } from '../src/core/navigation'

describe('notification hosts', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows only transient notifications as toasts and auto-dismisses them', async () => {
    const store = createNotificationStore({ defaultDurationMs: 200 })
    const wrapper = mount(NotificationToastHost, { props: { store } })

    store.notify({ title: 'Saved', severity: 'success' })
    store.notify({ title: 'Persistent', persistent: true })
    await nextTick()

    expect(wrapper.findAll('.wf-notification-toast')).toHaveLength(1)
    expect(wrapper.text()).toContain('Saved')
    expect(wrapper.text()).not.toContain('Persistent')

    vi.advanceTimersByTime(200)
    await nextTick()
    expect(wrapper.findAll('.wf-notification-toast')).toHaveLength(0)
    wrapper.unmount()
  })

  it('renders persistent notifications in the center and navigates through the existing navigator', async () => {
    const store = createNotificationStore()
    const navigate = vi.fn(() => ({ widgetId: 'market.ticker', instanceId: 'market-1' }))
    const navigator: WidgetNavigator = { navigate }
    const wrapper = mount(NotificationCenter, { props: { store, navigator } })

    store.notify({ title: 'Transient', durationMs: 0 })
    store.notify({
      title: 'Open market',
      message: 'Steel inventory is low.',
      severity: 'warning',
      persistent: true,
      actionLabel: 'Inspect',
      target: { widgetId: 'market.ticker', parameters: { commodity: 'STEEL' } },
    })
    await nextTick()

    expect(wrapper.findAll('.wf-notification-center__item')).toHaveLength(1)
    expect(wrapper.text()).toContain('Open market')
    await wrapper.get('.wf-notification-center__action').trigger('click')

    expect(navigate).toHaveBeenCalledWith({
      widgetId: 'market.ticker',
      parameters: { commodity: 'STEEL' },
    })
    expect(store.getSnapshot().map((item) => item.title)).toEqual(['Transient'])
    expect(wrapper.text()).toContain('No persistent notifications.')
    wrapper.unmount()
  })
})
