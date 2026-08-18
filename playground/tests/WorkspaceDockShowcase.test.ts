import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DataClientProvider, ThemeProvider, createDataClient, createMockDataProvider, forgeDarkTheme } from 'widgetforge'
import WorkspaceDockShowcase from '../src/WorkspaceDockShowcase.vue'

const provider = createMockDataProvider()
const client = createDataClient(provider)

describe('WorkspaceDockShowcase', () => {
  it('renders real top and bottom docks backed by pane trees', () => {
    const wrapper = mount({
      components: { DataClientProvider, ThemeProvider, WorkspaceDockShowcase },
      setup: () => ({ client, forgeDarkTheme }),
      template: '<ThemeProvider :theme="forgeDarkTheme"><DataClientProvider :client="client"><WorkspaceDockShowcase /></DataClientProvider></ThemeProvider>',
    })

    expect(wrapper.findAll('[data-dock-id]')).toHaveLength(2)
    expect(wrapper.get('[data-dock-id="demo-top"]').attributes('data-dock-position')).toBe('top')
    expect(wrapper.get('[data-dock-id="demo-bottom"]').attributes('data-dock-position')).toBe('bottom')
    expect(wrapper.findAll('[data-dock-id="demo-top"] [data-pane-kind="widget"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('DOCK-A')
    expect(wrapper.text()).toContain('DOCK')
  })
})
