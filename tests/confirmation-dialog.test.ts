import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import ConfirmationDialog from '../src/vue/ConfirmationDialog.vue'

describe('ConfirmationDialog', () => {
  it('uses safe initial focus, traps button focus and cancels with escape', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()

    const wrapper = mount(ConfirmationDialog, {
      props: {
        open: true,
        title: 'Delete layout?',
        message: 'This action cannot be undone.',
      },
      attachTo: document.body,
    })
    await nextTick()

    const cancel = wrapper.get('.wf-confirmation-dialog__cancel')
    const confirm = wrapper.get('.wf-confirmation-dialog__confirm')
    expect(document.activeElement).toBe(cancel.element)

    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(confirm.element)
    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(cancel.element)

    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])

    await wrapper.setProps({ open: false })
    await nextTick()
    expect(document.activeElement).toBe(opener)

    wrapper.unmount()
    opener.remove()
  })

  it('emits confirmation declaratively', async () => {
    const wrapper = mount(ConfirmationDialog, {
      props: { open: true, title: 'Proceed?', tone: 'danger', confirmLabel: 'Delete' },
    })
    await nextTick()
    await wrapper.get('.wf-confirmation-dialog__confirm').trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })
})
