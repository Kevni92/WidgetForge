import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SimpleTable from '../src/primitives/SimpleTable.vue'
import type { SimpleTableColumn } from '../src/primitives/simple-table'
import SimpleTableFixture from './fixtures/SimpleTableFixture.vue'

describe('SimpleTable', () => {
  it('renders declarative typed columns with native table semantics', () => {
    interface Row {
      name: string
      quantity: number
    }

    const columns: SimpleTableColumn<Row>[] = [
      { id: 'name', header: 'Name', field: 'name' },
      { id: 'quantity', header: 'Quantity', field: 'quantity', align: 'end' },
    ]
    const wrapper = mount(SimpleTable<Row>, {
      props: {
        columns,
        rows: [{ name: 'Ore', quantity: 12 }],
        caption: 'Inventory',
      },
    })

    expect(wrapper.get('table').element.tagName).toBe('TABLE')
    expect(wrapper.get('caption').text()).toBe('Inventory')
    expect(wrapper.findAll('th')).toHaveLength(2)
    expect(wrapper.get('th').attributes('scope')).toBe('col')
    expect(wrapper.findAll('td')).toHaveLength(2)
    expect(wrapper.text()).toContain('Ore')
    expect(wrapper.text()).toContain('12')
  })

  it('supports formatted default cells and interactive per-column consumer slots', async () => {
    const wrapper = mount(SimpleTableFixture)

    expect(wrapper.text()).toContain('120 t')
    expect(wrapper.text()).toContain('480 t')
    expect(wrapper.findAll('.wf-info-popover')).toHaveLength(2)

    await wrapper.findAll('.wf-info-popover')[0]?.trigger('mouseenter')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Commodity details for Steel')
  })
})
