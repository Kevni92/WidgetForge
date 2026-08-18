import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DataTableFixture from './fixtures/DataTableFixture.vue'

describe('DataTable', () => {
  it('sorts through controlled header actions and exposes aria-sort', async () => {
    const wrapper = mount(DataTableFixture)
    const stockHeader = wrapper.findAll('.wf-data-table__header').find((header) => header.text().includes('Stock'))

    expect(stockHeader).toBeDefined()
    await stockHeader?.get('button').trigger('click')
    expect(wrapper.get('[data-test="sort"]').text()).toBe('stock:asc')
    expect(stockHeader?.attributes('aria-sort')).toBe('ascending')

    const rows = wrapper.findAll('.wf-data-table__row')
    expect(rows[0]?.text()).toContain('Electronics')

    await stockHeader?.get('button').trigger('click')
    expect(wrapper.get('[data-test="sort"]').text()).toBe('stock:desc')
  })

  it('filters rows and supports keyboard row selection with stable ids', async () => {
    const wrapper = mount(DataTableFixture)
    const filter = wrapper.get('.wf-data-table__filter')

    await filter.setValue('Core')
    expect(wrapper.findAll('.wf-data-table__row')).toHaveLength(2)
    expect(wrapper.get('.wf-data-table__count').text()).toContain('2 / 3')

    const firstRow = wrapper.findAll('.wf-data-table__row')[0]
    expect(firstRow?.attributes('tabindex')).toBe('0')
    await firstRow?.trigger('keydown', { key: 'Enter' })
    expect(wrapper.get('[data-test="selection"]').text()).toBe('steel-core')
    expect(firstRow?.attributes('aria-selected')).toBe('true')
  })

  it('keeps consumer-provided interactive cell content usable', async () => {
    const wrapper = mount(DataTableFixture)

    await wrapper.get('.wf-info-popover').trigger('mouseenter')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Steel market details')
  })
})
