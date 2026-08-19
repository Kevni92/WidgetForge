import { defineComponent, h, markRaw } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { WidgetViewStateProvider, createLocalStorageWidgetViewStateStorage, createWidgetViewStateStore } from 'widgetforge'
import App from '../src/App.vue'

const KEY = 'widgetforge.playground.widget-view-state.test.v1'

function mountApp() {
  const store = markRaw(createWidgetViewStateStore(createLocalStorageWidgetViewStateStorage(window.localStorage, KEY)))
  const Root = defineComponent({ setup: () => () => h(WidgetViewStateProvider, { store }, () => h(App)) })
  return mount(Root)
}

describe('playground widget view state', () => {
  beforeEach(() => window.localStorage.clear())

  it('persists Market filter independently from workspace layout storage', async () => {
    const first = mountApp()
    const filter = first.get('input[aria-label="Market filter"]')
    await filter.setValue('Ferrite')
    expect((filter.element as HTMLInputElement).value).toBe('Ferrite')
    const saved = window.localStorage.getItem(KEY)
    expect(saved).toContain('Ferrite')
    first.unmount()

    const second = mountApp()
    expect((second.get('input[aria-label="Market filter"]').element as HTMLInputElement).value).toBe('Ferrite')
    expect(window.localStorage.getItem('widgetforge.playground.fullscreen.v3')).not.toContain('Ferrite')
    second.unmount()
  })
})
