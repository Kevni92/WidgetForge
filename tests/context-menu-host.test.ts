import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ContextMenuHost from '../src/vue/ContextMenuHost.vue'
import { createContextMenuController } from '../src/core/context-menu'
import type { WidgetNavigator } from '../src/core/navigation'

describe('ContextMenuHost', () => {
  it('supports keyboard focus, escape and optional widget navigation', async () => {
    const opener = document.createElement('button')
    opener.textContent = 'Opener'
    document.body.append(opener)
    opener.focus()

    const controller = createContextMenuController()
    const navigate = vi.fn(() => ({ widgetId: 'market.ticker', instanceId: 'market-ctx' }))
    const navigator: WidgetNavigator = { navigate }
    const wrapper = mount(ContextMenuHost, { props: { controller, navigator }, attachTo: document.body })

    controller.show({
      x: 20,
      y: 30,
      items: [
        { id: 'disabled', label: 'Unavailable', disabled: true },
        { id: 'market', label: 'Open market', target: { widgetId: 'market.ticker' } },
        { id: 'delete', label: 'Delete', tone: 'danger' },
      ],
    })
    await nextTick()
    await nextTick()

    const enabled = wrapper.findAll('[role="menuitem"]').filter((item) => item.attributes('disabled') === undefined)
    expect(document.activeElement).toBe(enabled[0]?.element)

    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(enabled[1]?.element)

    await enabled[0]?.trigger('click')
    expect(navigate).toHaveBeenCalledWith({ widgetId: 'market.ticker' })
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    await nextTick()
    expect(document.activeElement).toBe(opener)

    controller.show({ x: 0, y: 0, items: [{ id: 'one', label: 'One' }] })
    await nextTick()
    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Escape' })
    expect(controller.getSnapshot().open).toBe(false)

    wrapper.unmount()
    opener.remove()
  })
})
