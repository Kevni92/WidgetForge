const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled]):not([data-pane-drag-handle])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function hiddenByAncestor(element: HTMLElement): boolean {
  let current: HTMLElement | null = element
  while (current) {
    if (current.hidden || current.getAttribute('aria-hidden') === 'true' || current.hasAttribute('inert')) return true
    const style = globalThis.getComputedStyle?.(current)
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return true
    current = current.parentElement
  }
  return false
}

export function canReceiveFocus(element: HTMLElement | null): element is HTMLElement {
  if (!element || !element.isConnected || element === document.body || hiddenByAncestor(element)) return false
  if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true' || element.closest('fieldset:disabled')) return false
  if ('disabled' in element && Boolean((element as HTMLElement & { disabled?: boolean }).disabled)) return false
  return element.matches(FOCUSABLE_SELECTOR) || element.getAttribute('tabindex') === '-1'
}

export function focusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((element) => canReceiveFocus(element))
}

function preferredInitialFocus(container: HTMLElement): HTMLElement | null {
  const explicit = container.querySelector<HTMLElement>('[data-dialog-initial-focus], [autofocus]')
  if (canReceiveFocus(explicit)) return explicit
  const primary = container.querySelector<HTMLElement>('[data-dialog-primary-action], [data-primary-action]')
  return canReceiveFocus(primary) ? primary : null
}

export function focusModal(container: HTMLElement): HTMLElement {
  const target = preferredInitialFocus(container) ?? focusableElements(container)[0] ?? container
  target.focus()
  return target
}

export function trapFocus(container: HTMLElement, backwards: boolean): HTMLElement {
  const focusable = focusableElements(container)
  if (focusable.length === 0) {
    container.focus()
    return container
  }
  const current = document.activeElement instanceof HTMLElement ? focusable.indexOf(document.activeElement) : -1
  const nextIndex = backwards
    ? (current <= 0 ? focusable.length - 1 : current - 1)
    : (current < 0 || current >= focusable.length - 1 ? 0 : current + 1)
  const target = focusable[nextIndex] ?? focusable[0]
  if (!target) {
    container.focus()
    return container
  }
  target.focus()
  return target
}
