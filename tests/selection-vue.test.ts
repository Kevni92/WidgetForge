import { defineComponent, h, onMounted } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createSelectionKey, createSelectionStore } from '../src/core/selection'
import SelectionProvider from '../src/vue/SelectionProvider.vue'
import { useSelection } from '../src/vue/selection-context'

const key = createSelectionKey<string>('entity', 'shared')

describe('Vue selection context', () => {
  it('updates multiple unrelated widget-like consumers without remounting them', async () => {
    let firstMounts = 0
    let secondMounts = 0
    const Publisher = defineComponent({
      setup() {
        const selection = useSelection(key)
        return () => h('button', { class: 'publish', onClick: () => selection.select('ENTITY-2') }, 'publish')
      },
    })
    const Consumer = (className: string, mounted: () => void) => defineComponent({
      setup() {
        const selection = useSelection(key)
        onMounted(mounted)
        return () => h('span', { class: className }, selection.value.value ?? 'none')
      },
    })
    const First = Consumer('first', () => { firstMounts += 1 })
    const Second = Consumer('second', () => { secondMounts += 1 })
    const store = createSelectionStore()
    store.select(key, 'ENTITY-1')
    const Root = defineComponent({ setup: () => () => h(SelectionProvider, { store }, () => [h(Publisher), h(First), h(Second)]) })
    const wrapper = mount(Root)

    expect(wrapper.get('.first').text()).toBe('ENTITY-1')
    expect(wrapper.get('.second').text()).toBe('ENTITY-1')
    expect([firstMounts, secondMounts]).toEqual([1, 1])

    await wrapper.get('.publish').trigger('click')
    expect(wrapper.get('.first').text()).toBe('ENTITY-2')
    expect(wrapper.get('.second').text()).toBe('ENTITY-2')
    expect([firstMounts, secondMounts]).toEqual([1, 1])
    wrapper.unmount()
  })
})
