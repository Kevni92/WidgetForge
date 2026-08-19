<script setup lang="ts">
import { ref, useId } from 'vue'

export type InfoPopoverPlacement = 'top' | 'right' | 'bottom' | 'left'

const props = withDefaults(defineProps<{
  label: string
  placement?: InfoPopoverPlacement
}>(), {
  placement: 'bottom',
})

const panelId = `${useId()}-wf-info-popover`
const root = ref<HTMLElement | null>(null)
const open = ref(false)

function show(): void {
  open.value = true
}

function hide(): void {
  open.value = false
}

function toggle(): void {
  open.value = !open.value
}

function handleMouseLeave(): void {
  const active = document.activeElement
  if (active && root.value?.contains(active)) return
  hide()
}

function handleFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget
  if (next instanceof Node && root.value?.contains(next)) return
  hide()
}

function handleEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !open.value) return
  event.preventDefault()
  event.stopPropagation()
  hide()
}
</script>

<template>
  <span
    ref="root"
    class="wf-info-popover"
    :data-open="open ? 'true' : 'false'"
    @mouseenter="show"
    @mouseleave="handleMouseLeave"
    @focusout="handleFocusOut"
    @keydown="handleEscape"
  >
    <button
      type="button"
      class="wf-info-popover__trigger"
      aria-haspopup="dialog"
      :aria-label="props.label"
      :aria-expanded="open"
      :aria-controls="panelId"
      @focus="show"
      @click="toggle"
    >
      <slot name="trigger">{{ props.label }}</slot>
    </button>

    <span
      v-if="open"
      :id="panelId"
      class="wf-info-popover__panel"
      :class="`wf-info-popover__panel--${props.placement}`"
      role="dialog"
      :aria-label="props.label"
    >
      <slot />
    </span>
  </span>
</template>

<style scoped>
.wf-info-popover {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.wf-info-popover__trigger {
  display: inline-flex;
  align-items: center;
  min-height: var(--wf-size-control-height);
  padding: 0 var(--wf-space-sm);
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-sm);
  background: transparent;
  color: var(--wf-color-info);
  font: inherit;
  font-size: var(--wf-font-size-sm);
  cursor: help;
}

.wf-info-popover__trigger:hover {
  background: var(--wf-color-hover);
}

.wf-info-popover__trigger:focus-visible {
  outline: 2px solid var(--wf-color-focus);
  outline-offset: 2px;
}

.wf-info-popover__panel {
  position: absolute;
  z-index: var(--wf-layer-tooltip);
  display: block;
  width: max-content;
  max-width: min(360px, 80vw);
  padding: var(--wf-space-md);
  border: 1px solid var(--wf-color-border-floating);
  border-radius: var(--wf-radius-md);
  background: var(--wf-color-surface-floating);
  color: var(--wf-color-text);
  box-shadow: var(--wf-shadow-lg);
  font-size: var(--wf-font-size-sm);
  line-height: 1.45;
}

.wf-info-popover__panel--bottom {
  top: calc(100% + var(--wf-space-xs));
  left: 0;
}

.wf-info-popover__panel--top {
  bottom: calc(100% + var(--wf-space-xs));
  left: 0;
}

.wf-info-popover__panel--right {
  top: 0;
  left: calc(100% + var(--wf-space-xs));
}

.wf-info-popover__panel--left {
  top: 0;
  right: calc(100% + var(--wf-space-xs));
}
</style>
