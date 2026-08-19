import { afterEach, describe, expect, it } from 'vitest'
import { canReceiveFocus, focusModal, focusableElements, trapFocus } from '../src/vue/modal-focus'

const containers: HTMLElement[] = []

afterEach(() => {
  for (const container of containers) container.remove()
  containers.length = 0
})

function createContainer(markup: string): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = markup
  document.body.append(container)
  containers.push(container)
  return container
}

describe('modal focus helpers', () => {
  it('filters disabled, hidden, inert and structural controls and sees dynamic content on each query', () => {
    const container = createContainer(`
      <button data-pane-drag-handle>Move</button>
      <button disabled>Disabled</button>
      <button hidden>Hidden</button>
      <div inert><button>Inert</button></div>
      <button data-visible>Visible</button>
    `)

    expect(focusableElements(container).map((element) => element.dataset.visible)).toEqual([''])
    const dynamic = document.createElement('button')
    dynamic.dataset.dynamic = 'true'
    container.append(dynamic)
    expect(focusableElements(container).map((element) => element.dataset.dynamic ?? element.dataset.visible)).toEqual(['', 'true'])
    expect(canReceiveFocus(container.querySelector('[hidden]'))).toBe(false)
  })

  it('uses explicit initial focus and cycles current controls in both directions', () => {
    const container = createContainer('<button>Secondary</button><button data-dialog-initial-focus>Primary</button><button>Last</button>')
    const buttons = () => focusableElements(container)

    focusModal(container)
    expect(document.activeElement).toBe(buttons()[1])
    trapFocus(container, false)
    expect(document.activeElement).toBe(buttons()[2])
    trapFocus(container, false)
    expect(document.activeElement).toBe(buttons()[0])
    trapFocus(container, true)
    expect(document.activeElement).toBe(buttons()[2])
  })
})
