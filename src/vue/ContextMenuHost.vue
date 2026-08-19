<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import type { ContextMenuController, ContextMenuItem, ContextMenuState } from '../core/context-menu'
import type { WidgetNavigator } from '../core/navigation'

const props = defineProps<{
  controller: ContextMenuController
  navigator?: WidgetNavigator
}>()

const state = ref<ContextMenuState>(props.controller.getSnapshot())
const menu = ref<HTMLElement | null>(null)
let unsubscribe: (() => void) | undefined
let previousFocus: HTMLElement | null = null

const menuStyle = computed(() => {
  const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight
  return {
    left: `${Math.min(state.value.x, Math.max(8, viewportWidth - 240))}px`,
    top: `${Math.min(state.value.y, Math.max(8, viewportHeight - 160))}px`,
  }
})

function enabledButtons(): HTMLButtonElement[] {
  return [...(menu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
}

function focusFirst(): void {
  enabledButtons()[0]?.focus()
}

function refresh(nextState = props.controller.getSnapshot()): void {
  const wasOpen = state.value.open
  if (!wasOpen && nextState.open) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }
  state.value = nextState
  if (!wasOpen && nextState.open) void nextTick(focusFirst)
  if (wasOpen && !nextState.open) {
    const restore = previousFocus
    previousFocus = null
    void nextTick(() => restore?.focus())
  }
}

function activate(item: ContextMenuItem): void {
  const selected = props.controller.select(item.id)
  if (selected?.target && props.navigator) props.navigator.navigate(selected.target)
}

function handleKeydown(event: KeyboardEvent): void {
  const buttons = enabledButtons()
  if (event.key === 'Escape') {
    event.preventDefault()
    props.controller.close()
    return
  }
  if (buttons.length === 0) return

  const activeIndex = buttons.indexOf(document.activeElement as HTMLButtonElement)
  let nextIndex: number | null = null
  if (event.key === 'ArrowDown') nextIndex = (activeIndex + 1 + buttons.length) % buttons.length
  if (event.key === 'ArrowUp') nextIndex = (activeIndex - 1 + buttons.length) % buttons.length
  if (event.key === 'Home') nextIndex = 0
  if (event.key === 'End') nextIndex = buttons.length - 1
  if (nextIndex === null) return
  event.preventDefault()
  buttons[nextIndex]?.focus()
}

function handleDocumentPointer(event: PointerEvent): void {
  if (!state.value.open) return
  const target = event.target
  if (target instanceof Node && menu.value?.contains(target)) return
  props.controller.close()
}

onMounted(() => {
  unsubscribe = props.controller.subscribe(refresh)
  document.addEventListener('pointerdown', handleDocumentPointer, true)
  refresh()
})

onUnmounted(() => {
  unsubscribe?.()
  document.removeEventListener('pointerdown', handleDocumentPointer, true)
})
</script>

<template>
  <div
    v-if="state.open"
    ref="menu"
    class="wf-context-menu"
    role="menu"
    :style="menuStyle"
    @keydown="handleKeydown"
    @contextmenu.prevent
  >
    <button
      v-for="item in state.items"
      :key="item.id"
      type="button"
      role="menuitem"
      class="wf-context-menu__item"
      :class="{ 'wf-context-menu__item--danger': item.tone === 'danger' }"
      :disabled="item.disabled"
      @click="activate(item)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.wf-context-menu {
  position: fixed;
  z-index: var(--wf-layer-overlay);
  display: grid;
  width: max-content;
  min-width: 180px;
  max-width: min(320px, calc(100vw - 16px));
  max-height: calc(100vh - 16px);
  overflow: auto;
  padding: var(--wf-space-xs);
  border: 1px solid var(--wf-color-border-floating);
  border-radius: var(--wf-radius-md);
  background: var(--wf-color-surface-floating);
  box-shadow: var(--wf-shadow-lg);
}

.wf-context-menu__item {
  min-height: var(--wf-size-control-height-compact);
  padding: 0 var(--wf-space-md);
  border: 0;
  border-radius: var(--wf-radius-sm);
  background: transparent;
  color: var(--wf-color-text);
  font: inherit;
  font-size: var(--wf-font-size-sm);
  text-align: start;
  cursor: pointer;
}

.wf-context-menu__item:hover,
.wf-context-menu__item:focus-visible {
  background: var(--wf-color-hover);
  outline: none;
}

.wf-context-menu__item:focus-visible {
  box-shadow: inset 0 0 0 2px var(--wf-color-focus);
}

.wf-context-menu__item--danger { color: var(--wf-color-danger); }
.wf-context-menu__item:disabled {
  color: var(--wf-color-text-muted);
  cursor: default;
  opacity: 0.6;
}
</style>
