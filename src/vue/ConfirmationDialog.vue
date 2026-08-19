<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  initialFocus?: 'cancel' | 'confirm'
}>(), {
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  tone: 'default',
  initialFocus: 'cancel',
})

const emit = defineEmits<{
  'update:open': [open: boolean]
  confirm: []
  cancel: []
}>()

const cancelButton = ref<HTMLButtonElement | null>(null)
const confirmButton = ref<HTMLButtonElement | null>(null)
const uid = useId()
const titleId = `${uid}-title`
const messageId = `${uid}-message`
let previousFocus: HTMLElement | null = null

function close(kind: 'confirm' | 'cancel'): void {
  if (kind === 'confirm') emit('confirm')
  else emit('cancel')
  emit('update:open', false)
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    close('cancel')
    return
  }
  if (event.key !== 'Tab') return

  const buttons = [cancelButton.value, confirmButton.value].filter((button): button is HTMLButtonElement => button !== null)
  if (buttons.length === 0) return
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const direction = event.shiftKey ? -1 : 1
  const next = (index + direction + buttons.length) % buttons.length
  event.preventDefault()
  buttons[next]?.focus()
}

function handleBackdrop(event: MouseEvent): void {
  if (event.target === event.currentTarget) close('cancel')
}

watch(() => props.open, async (open) => {
  if (open) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    if (props.initialFocus === 'confirm') confirmButton.value?.focus()
    else cancelButton.value?.focus()
    return
  }

  const restore = previousFocus
  previousFocus = null
  await nextTick()
  restore?.focus()
}, { immediate: true })
</script>

<template>
  <div
    v-if="props.open"
    class="wf-confirmation-backdrop"
    @mousedown="handleBackdrop"
  >
    <section
      class="wf-confirmation-dialog"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="props.message ? messageId : undefined"
      @keydown="handleKeydown"
    >
      <header class="wf-confirmation-dialog__header">
        <strong :id="titleId">{{ props.title }}</strong>
      </header>
      <div class="wf-confirmation-dialog__body">
        <slot>
          <p v-if="props.message" :id="messageId">{{ props.message }}</p>
        </slot>
      </div>
      <footer class="wf-confirmation-dialog__actions">
        <button
          ref="cancelButton"
          type="button"
          class="wf-confirmation-dialog__cancel"
          @click="close('cancel')"
        >
          {{ props.cancelLabel }}
        </button>
        <button
          ref="confirmButton"
          type="button"
          class="wf-confirmation-dialog__confirm"
          :class="{ 'wf-confirmation-dialog__confirm--danger': props.tone === 'danger' }"
          @click="close('confirm')"
        >
          {{ props.confirmLabel }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.wf-confirmation-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--wf-layer-overlay);
  display: grid;
  place-items: center;
  padding: var(--wf-space-lg);
  background: var(--wf-color-backdrop);
}

.wf-confirmation-dialog {
  width: min(440px, 100%);
  border: 1px solid var(--wf-color-border-modal);
  border-radius: var(--wf-radius-md);
  background: var(--wf-color-surface-modal);
  color: var(--wf-color-text);
  box-shadow: var(--wf-shadow-lg);
}

.wf-confirmation-dialog__header {
  min-height: var(--wf-size-titlebar-height);
  display: flex;
  align-items: center;
  padding: 0 var(--wf-space-md);
  border-bottom: 1px solid var(--wf-color-border-modal);
  font-size: var(--wf-font-size-sm);
}

.wf-confirmation-dialog__body {
  padding: var(--wf-space-lg);
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-sm);
}

.wf-confirmation-dialog__body p { margin: 0; }

.wf-confirmation-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--wf-space-sm);
  padding: 0 var(--wf-space-lg) var(--wf-space-lg);
}

.wf-confirmation-dialog__actions button {
  min-height: var(--wf-size-control-height);
  padding: 0 var(--wf-space-md);
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-sm);
  background: transparent;
  color: var(--wf-color-text);
  font: inherit;
  cursor: pointer;
}

.wf-confirmation-dialog__actions button:hover { background: var(--wf-color-hover); }
.wf-confirmation-dialog__actions button:focus-visible {
  outline: 2px solid var(--wf-color-focus);
  outline-offset: 2px;
}

.wf-confirmation-dialog__confirm {
  border-color: var(--wf-color-accent) !important;
  color: var(--wf-color-accent);
}

.wf-confirmation-dialog__confirm--danger {
  border-color: var(--wf-color-danger) !important;
  color: var(--wf-color-danger);
}
</style>
