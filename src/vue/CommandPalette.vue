<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CommandPaletteItem, CommandPaletteRegistry } from '../core/command-palette'

interface CommandPaletteProps {
  registry: CommandPaletteRegistry
  shortcut?: string
  title?: string
  placeholder?: string
  maxResults?: number
}

const props = withDefaults(defineProps<CommandPaletteProps>(), {
  shortcut: 'Ctrl+K',
  title: 'Command palette',
  placeholder: 'Search commands, widgets and actions',
  maxResults: 12,
})

const emit = defineEmits<{
  open: []
  close: []
  executed: [item: CommandPaletteItem]
  error: [error: Error, item: CommandPaletteItem]
}>()

let nextPaletteId = 0
nextPaletteId += 1
const paletteId = `wf-command-palette-${nextPaletteId}`
const listId = `${paletteId}-results`
const open = ref(false)
const query = ref('')
const activeIndex = ref(0)
const inputElement = ref<HTMLInputElement | null>(null)
const dialogElement = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null

const results = computed(() => props.registry.search(query.value).slice(0, Math.max(1, props.maxResults)))

function firstEnabledIndex(): number {
  const index = results.value.findIndex((result) => !result.item.disabled)
  return index >= 0 ? index : 0
}

watch(results, () => {
  activeIndex.value = firstEnabledIndex()
})

function parseShortcut(shortcut: string): { key: string; ctrl: boolean; meta: boolean; alt: boolean; shift: boolean } {
  const parts = shortcut.toLowerCase().split('+').map((part) => part.trim()).filter(Boolean)
  const key = parts.at(-1) ?? ''
  return {
    key,
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    meta: parts.includes('cmd') || parts.includes('command') || parts.includes('meta'),
    alt: parts.includes('alt') || parts.includes('option'),
    shift: parts.includes('shift'),
  }
}

function matchesShortcut(event: KeyboardEvent): boolean {
  const shortcut = parseShortcut(props.shortcut)
  return event.key.toLowerCase() === shortcut.key
    && event.ctrlKey === shortcut.ctrl
    && event.metaKey === shortcut.meta
    && event.altKey === shortcut.alt
    && event.shiftKey === shortcut.shift
}

async function openPalette(): Promise<void> {
  if (open.value) return
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  query.value = ''
  activeIndex.value = firstEnabledIndex()
  open.value = true
  emit('open')
  await nextTick()
  inputElement.value?.focus()
}

function closePalette(): void {
  if (!open.value) return
  open.value = false
  emit('close')
  nextTick(() => previousFocus?.focus())
}

function togglePalette(): void {
  if (open.value) closePalette()
  else void openPalette()
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (!matchesShortcut(event)) return
  event.preventDefault()
  togglePalette()
}

function moveSelection(direction: 1 | -1): void {
  if (results.value.length === 0) return
  let index = activeIndex.value
  for (let attempts = 0; attempts < results.value.length; attempts += 1) {
    index = (index + direction + results.value.length) % results.value.length
    if (!results.value[index]?.item.disabled) {
      activeIndex.value = index
      return
    }
  }
}

function execute(item: CommandPaletteItem): void {
  if (item.disabled) return
  try {
    item.execute()
    emit('executed', item)
    closePalette()
  } catch (error) {
    emit('error', error instanceof Error ? error : new Error('Command palette execution failed'), item)
  }
}

function executeActive(): void {
  const result = results.value[activeIndex.value]
  if (result) execute(result.item)
}

function focusableElements(): HTMLElement[] {
  const dialog = dialogElement.value
  if (!dialog) return []
  return [...dialog.querySelectorAll<HTMLElement>('input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
}

function trapTab(event: KeyboardEvent): void {
  const focusable = focusableElements()
  if (focusable.length === 0) {
    event.preventDefault()
    return
  }
  const current = document.activeElement instanceof HTMLElement ? focusable.indexOf(document.activeElement) : -1
  const next = event.shiftKey
    ? (current <= 0 ? focusable.length - 1 : current - 1)
    : (current < 0 || current >= focusable.length - 1 ? 0 : current + 1)
  event.preventDefault()
  focusable[next]?.focus()
}

function handleDialogKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    closePalette()
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveSelection(1)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveSelection(-1)
    return
  }
  if (event.key === 'Enter' && document.activeElement === inputElement.value) {
    event.preventDefault()
    executeActive()
    return
  }
  if (event.key === 'Tab') trapTab(event)
}

function resultId(index: number): string {
  return `${paletteId}-result-${index}`
}

onMounted(() => window.addEventListener('keydown', handleGlobalKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleGlobalKeydown))

defineExpose({ open: openPalette, close: closePalette, toggle: togglePalette })
</script>

<template>
  <div v-if="open" class="wf-command-palette" data-command-palette @mousedown.self="closePalette">
    <section
      ref="dialogElement"
      class="wf-command-palette__dialog"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`${paletteId}-title`"
      @keydown="handleDialogKeydown"
    >
      <header class="wf-command-palette__header">
        <h2 :id="`${paletteId}-title`">{{ title }}</h2>
        <kbd>{{ shortcut }}</kbd>
      </header>
      <input
        ref="inputElement"
        v-model="query"
        class="wf-command-palette__input"
        type="search"
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        :placeholder="placeholder"
        :aria-controls="listId"
        aria-expanded="true"
        aria-autocomplete="list"
        :aria-activedescendant="results.length ? resultId(activeIndex) : undefined"
      />
      <div :id="listId" class="wf-command-palette__results" role="listbox" aria-label="Command palette results">
        <button
          v-for="(result, index) in results"
          :id="resultId(index)"
          :key="result.item.id"
          class="wf-command-palette__result"
          :class="{ 'wf-command-palette__result--active': index === activeIndex }"
          type="button"
          role="option"
          :aria-selected="index === activeIndex"
          :disabled="result.item.disabled"
          :data-palette-item="result.item.id"
          @mouseenter="activeIndex = index"
          @click="execute(result.item)"
        >
          <span v-if="result.item.icon" class="wf-command-palette__icon" aria-hidden="true">{{ result.item.icon }}</span>
          <span class="wf-command-palette__copy">
            <strong>{{ result.item.label }}</strong>
            <small>{{ result.item.category }}</small>
          </span>
          <kbd v-if="result.item.shortcut">{{ result.item.shortcut }}</kbd>
        </button>
        <p v-if="results.length === 0" class="wf-command-palette__empty" role="status">No matching commands</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.wf-command-palette{position:fixed;inset:0;z-index:var(--wf-layer-overlay);display:grid;place-items:start center;padding:12vh var(--wf-space-md) var(--wf-space-md);background:var(--wf-color-backdrop);backdrop-filter:blur(3px)}
.wf-command-palette__dialog{width:min(680px,100%);max-height:min(72vh,620px);display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:var(--wf-space-sm);padding:var(--wf-space-md);border:1px solid var(--wf-color-border-modal);border-radius:var(--wf-radius-md);background:var(--wf-color-surface-modal);box-shadow:var(--wf-shadow-lg);color:var(--wf-color-text);font-family:var(--wf-font-family)}
.wf-command-palette__header{display:flex;align-items:center;justify-content:space-between;gap:var(--wf-space-md)}
.wf-command-palette__header h2{margin:0;font-size:var(--wf-font-size-md);font-weight:var(--wf-font-weight-semibold)}
.wf-command-palette kbd{padding:2px 6px;border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface-raised);color:var(--wf-color-text-muted);font:inherit;font-size:var(--wf-font-size-xs)}
.wf-command-palette__input{width:100%;min-height:var(--wf-size-control-height);padding:0 var(--wf-space-md);border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);outline:none;background:var(--wf-color-surface-raised);color:var(--wf-color-text);font:inherit}.wf-command-palette__input::placeholder{color:var(--wf-color-text-placeholder);opacity:1}
.wf-command-palette__input:focus{border-color:var(--wf-color-focus);box-shadow:0 0 0 1px var(--wf-color-focus)}
.wf-command-palette__results{min-height:0;overflow:auto;display:grid;align-content:start;gap:2px}
.wf-command-palette__result{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:var(--wf-space-sm);min-height:var(--wf-size-control-height-compact);padding:var(--wf-space-sm);border:1px solid transparent;border-radius:var(--wf-radius-sm);background:transparent;color:var(--wf-color-text);font:inherit;text-align:left;cursor:pointer}
.wf-command-palette__result:hover,.wf-command-palette__result--active{border-color:var(--wf-color-border);background:var(--wf-color-selected)}
.wf-command-palette__result:disabled{opacity:.45;cursor:not-allowed}
.wf-command-palette__icon{display:grid;place-items:center;width:var(--wf-size-icon-button-size);height:var(--wf-size-icon-button-size);color:var(--wf-color-accent);font-size:var(--wf-size-icon-size);line-height:1}
.wf-command-palette__copy{display:grid;min-width:0;gap:2px}.wf-command-palette__copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--wf-font-size-sm)}.wf-command-palette__copy small{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs)}
.wf-command-palette__empty{margin:0;padding:var(--wf-space-lg);text-align:center;color:var(--wf-color-text-muted);font-size:var(--wf-font-size-sm)}
</style>
