<style scoped>
.wf-widget-action-toolbar .wf-widget-action-toolbar__action { height: var(--wf-size-control-height-compact); }
.wf-widget-action-toolbar .wf-widget-action-toolbar__more { width: var(--wf-size-icon-button-size); height: var(--wf-size-icon-button-size); }
.wf-widget-action-toolbar.wf-widget-action-toolbar--compact .wf-widget-action-toolbar__action { width: var(--wf-size-icon-button-size); height: var(--wf-size-icon-button-size); }
.wf-widget-action-toolbar .wf-widget-action-toolbar__menu-action { min-height: var(--wf-size-control-height-compact); }
.wf-widget-action-toolbar .wf-widget-action-toolbar__action > span:first-child,
.wf-widget-action-toolbar .wf-widget-action-toolbar__menu-action > span:first-child,
.wf-widget-action-toolbar .wf-widget-action-toolbar__measurement .wf-widget-action-toolbar__action > span:first-child { font-size: var(--wf-size-icon-size); line-height: 1; }
</style>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { WidgetActionBinding } from '../core/widget-actions'
import { calculateWidgetActionOverflow } from '../core/widget-action-overflow'
import { observeElementSize } from './observe-element-size'

interface Props {
  bindings: readonly WidgetActionBinding[]
  maxVisible?: number
  ariaLabel?: string
  compact?: boolean
  orientation?: 'horizontal' | 'vertical'
  /** Optional deterministic inline size; otherwise the toolbar measures its host. */
  availableSize?: number
  overflowButtonSize?: number
  /** Optional consumer-defined data hook for action instrumentation. */
  dataActionAttribute?: string
}

const props = withDefaults(defineProps<Props>(), {
  maxVisible: 3,
  ariaLabel: 'Widget actions',
  compact: false,
  orientation: 'horizontal',
  overflowButtonSize: 30,
})

let nextToolbarId = 0
nextToolbarId += 1
const menuId = `wf-widget-action-overflow-${nextToolbarId}`
const rootElement = ref<HTMLElement | null>(null)
const measurementElement = ref<HTMLElement | null>(null)
const overflowButton = ref<HTMLButtonElement | null>(null)
const menuElement = ref<HTMLElement | null>(null)
const menuOpen = ref(false)
const measuredSize = shallowRef({ width: 0, height: 0 })
const measuredActionSizes = shallowRef<Readonly<Record<string, number>>>({})
const menuStyle = ref<Record<string, string>>({})
let disposeSize: (() => void) | undefined
let previousFocus: HTMLElement | null = null

const actionSignature = computed(() => props.bindings.map(({ action }) => [
  action.id,
  action.label,
  action.icon,
  action.priority,
  action.group,
  action.alwaysVisible,
  action.overflowOnly,
  action.disabled,
  action.visible,
].join('|')).join('::'))

const availableSize = computed(() => props.availableSize ?? (props.orientation === 'horizontal' ? measuredSize.value.width : measuredSize.value.height))

function actionAttributes(binding: WidgetActionBinding): Record<string, string> {
  return props.dataActionAttribute ? { [props.dataActionAttribute]: binding.action.id } : {}
}

function fallbackActionSize(binding: WidgetActionBinding): number {
  if (props.compact) return 30
  return Math.max(50, 30 + binding.action.label.length * 7 + binding.action.icon.length * 3)
}

function actionSize(binding: WidgetActionBinding): number {
  return measuredActionSizes.value[binding.action.id] ?? fallbackActionSize(binding)
}

const layout = computed(() => calculateWidgetActionOverflow(props.bindings, {
  availableSize: availableSize.value > 0 ? availableSize.value : undefined,
  actionSize,
  overflowSize: props.overflowButtonSize,
  gap: 2,
  maxVisible: props.maxVisible,
}))
const primaryBindings = computed(() => layout.value.visible)
const overflowBindings = computed(() => layout.value.overflow)

function tooltip(binding: WidgetActionBinding): string {
  return binding.action.shortcut ? `${binding.action.label} (${binding.action.shortcut})` : binding.action.label
}

function execute(binding: WidgetActionBinding): void {
  if (binding.action.disabled || binding.action.visible === false) return
  binding.execute()
}

function onKeydown(event: KeyboardEvent, binding: WidgetActionBinding): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  execute(binding)
}

function measureActions(): void {
  const measurement = measurementElement.value
  if (!measurement) return
  const next: Record<string, number> = {}
  for (const element of measurement.querySelectorAll<HTMLElement>('[data-overflow-measure-id]')) {
    const id = element.dataset.overflowMeasureId
    if (!id) continue
    const width = element.getBoundingClientRect().width || element.offsetWidth
    if (width > 0) next[id] = width
  }
  const previous = measuredActionSizes.value
  const changed = Object.keys(next).length !== Object.keys(previous).length
    || Object.entries(next).some(([id, size]) => previous[id] !== size)
  if (changed) measuredActionSizes.value = next
}

function scheduleMeasure(): void {
  void nextTick(measureActions)
}

function enabledMenuItems(): HTMLButtonElement[] {
  return [...(menuElement.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
}

function focusFirstMenuItem(): void {
  enabledMenuItems()[0]?.focus()
}

function updateMenuPosition(): void {
  const button = overflowButton.value
  if (!button) return
  const rect = button.getBoundingClientRect()
  const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight
  const menuWidth = Math.min(260, Math.max(180, viewportWidth - 16))
  const left = props.orientation === 'vertical'
    ? Math.min(Math.max(8, rect.right + 2), Math.max(8, viewportWidth - menuWidth - 8))
    : Math.min(Math.max(8, rect.right - menuWidth), Math.max(8, viewportWidth - menuWidth - 8))
  const top = props.orientation === 'vertical'
    ? Math.min(Math.max(8, rect.top), Math.max(8, viewportHeight - 240))
    : Math.min(Math.max(8, rect.bottom + 2), Math.max(8, viewportHeight - 240))
  menuStyle.value = { left: `${left}px`, top: `${top}px`, minWidth: `${menuWidth}px` }
}

async function openOverflow(): Promise<void> {
  if (overflowBindings.value.length === 0 || menuOpen.value) return
  previousFocus = overflowButton.value ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
  menuOpen.value = true
  updateMenuPosition()
  await nextTick()
  focusFirstMenuItem()
}

function closeOverflow(restoreFocus = true): void {
  if (!menuOpen.value) return
  menuOpen.value = false
  const restore = previousFocus
  previousFocus = null
  if (restoreFocus) void nextTick(() => { if (restore?.isConnected) restore.focus() })
}

function toggleOverflow(): void {
  if (menuOpen.value) closeOverflow()
  else void openOverflow()
}

function activate(binding: WidgetActionBinding): void {
  if (binding.action.disabled || binding.action.visible === false) return
  closeOverflow()
  execute(binding)
}

function handleMenuKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeOverflow()
    return
  }
  if (event.key === 'Tab') {
    closeOverflow(false)
    return
  }
  const buttons = enabledMenuItems()
  if (buttons.length === 0) return
  const activeIndex = buttons.indexOf(document.activeElement as HTMLButtonElement)
  let nextIndex: number | null = null
  if (event.key === 'ArrowDown' || (props.orientation === 'horizontal' && event.key === 'ArrowRight')) nextIndex = (activeIndex + 1 + buttons.length) % buttons.length
  if (event.key === 'ArrowUp' || (props.orientation === 'horizontal' && event.key === 'ArrowLeft')) nextIndex = (activeIndex - 1 + buttons.length) % buttons.length
  if (event.key === 'Home') nextIndex = 0
  if (event.key === 'End') nextIndex = buttons.length - 1
  if (nextIndex === null) return
  event.preventDefault()
  buttons[nextIndex]?.focus()
}

function handleDocumentPointer(event: PointerEvent): void {
  if (!menuOpen.value) return
  const target = event.target
  if (target instanceof Node && (rootElement.value?.contains(target) || menuElement.value?.contains(target))) return
  closeOverflow()
}

watch(actionSignature, scheduleMeasure)
watch(() => overflowBindings.value.length, (length) => { if (length === 0) closeOverflow(false) })

onMounted(() => {
  const element = rootElement.value
  if (element) disposeSize = observeElementSize(element, (size) => { measuredSize.value = size })
  document.addEventListener('pointerdown', handleDocumentPointer, true)
  scheduleMeasure()
})

onBeforeUnmount(() => {
  disposeSize?.()
  disposeSize = undefined
  document.removeEventListener('pointerdown', handleDocumentPointer, true)
})
</script>

<template>
  <div
    ref="rootElement"
    class="wf-widget-action-toolbar"
    :class="{ 'wf-widget-action-toolbar--compact': compact, 'wf-widget-action-toolbar--vertical': orientation === 'vertical' }"
    :data-overflow-orientation="orientation"
    :data-overflow-open="menuOpen || undefined"
    role="toolbar"
    :aria-label="ariaLabel"
    :aria-orientation="orientation"
  >
    <button
      v-for="binding in primaryBindings"
      :key="binding.action.id"
      class="wf-widget-action-toolbar__action"
      :class="[`wf-widget-action-toolbar__action--${binding.action.tone ?? 'neutral'}`, { 'wf-widget-action-toolbar__action--pressed': binding.action.pressed }]"
      type="button"
      :data-widget-action="binding.action.id"
      v-bind="actionAttributes(binding)"
      :data-action-group="binding.action.group ?? 'default'"
      :aria-label="binding.action.label"
      :aria-pressed="binding.action.pressed === undefined ? undefined : binding.action.pressed"
      :title="tooltip(binding)"
      :disabled="binding.action.disabled"
      @click.stop="execute(binding)"
      @keydown.stop="onKeydown($event, binding)"
    ><span aria-hidden="true">{{ binding.action.icon }}</span><span v-if="!compact" class="wf-widget-action-toolbar__label">{{ binding.action.label }}</span></button>
    <button
      v-if="overflowBindings.length"
      ref="overflowButton"
      class="wf-widget-action-toolbar__more"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      :aria-controls="menuId"
      aria-label="More widget actions"
      title="More widget actions"
      data-overflow-trigger
      @click.stop="toggleOverflow"
    >⋯</button>

    <Teleport to="body">
      <div
        v-if="menuOpen"
        :id="menuId"
        ref="menuElement"
        class="wf-widget-action-toolbar__menu"
        role="menu"
        :aria-label="`${ariaLabel} overflow`"
        :style="menuStyle"
        data-overflow-menu
        @keydown="handleMenuKeydown"
      >
        <button
          v-for="binding in overflowBindings"
          :key="binding.action.id"
          class="wf-widget-action-toolbar__menu-action"
          :class="[`wf-widget-action-toolbar__action--${binding.action.tone ?? 'neutral'}`, { 'wf-widget-action-toolbar__action--pressed': binding.action.pressed }]"
          type="button"
          role="menuitem"
          :data-widget-action="binding.action.id"
          v-bind="actionAttributes(binding)"
          :data-action-group="binding.action.group ?? 'default'"
          :aria-label="binding.action.label"
          :aria-pressed="binding.action.pressed === undefined ? undefined : binding.action.pressed"
          :title="tooltip(binding)"
          :disabled="binding.action.disabled"
          @click.stop="activate(binding)"
          @keydown.stop="onKeydown($event, binding)"
        ><span aria-hidden="true">{{ binding.action.icon }}</span><span>{{ binding.action.label }}</span><kbd v-if="binding.action.shortcut">{{ binding.action.shortcut }}</kbd></button>
      </div>
    </Teleport>

    <div ref="measurementElement" class="wf-widget-action-toolbar__measurement" aria-hidden="true">
      <span
        v-for="binding in bindings.filter((candidate) => candidate.action.visible !== false)"
        :key="binding.action.id"
        class="wf-widget-action-toolbar__action"
        :class="{ 'wf-widget-action-toolbar__action--compact-measurement': compact }"
        :data-overflow-measure-id="binding.action.id"
      ><span aria-hidden="true">{{ binding.action.icon }}</span><span v-if="!compact" class="wf-widget-action-toolbar__label">{{ binding.action.label }}</span></span>
    </div>
  </div>
</template>

<style scoped>
.wf-widget-action-toolbar{display:flex;max-width:100%;min-width:0;align-items:center;gap:2px}.wf-widget-action-toolbar--vertical{flex-direction:column;align-items:stretch}.wf-widget-action-toolbar__action,.wf-widget-action-toolbar__more,.wf-widget-action-toolbar__menu-action{border:0;border-radius:var(--wf-radius-sm);background:transparent;color:var(--wf-color-text-muted);font:inherit;cursor:pointer}.wf-widget-action-toolbar__action{display:flex;height:var(--wf-size-control-height);align-items:center;gap:var(--wf-space-xs);padding:0 var(--wf-space-xs)}.wf-widget-action-toolbar--vertical .wf-widget-action-toolbar__action{width:100%;justify-content:flex-start}.wf-widget-action-toolbar__action:hover:not(:disabled),.wf-widget-action-toolbar__more:hover,.wf-widget-action-toolbar__menu-action:hover:not(:disabled){background:var(--wf-color-hover);color:var(--wf-color-text)}.wf-widget-action-toolbar__action:focus-visible,.wf-widget-action-toolbar__more:focus-visible,.wf-widget-action-toolbar__menu-action:focus-visible{outline:2px solid var(--wf-color-focus);outline-offset:-2px}.wf-widget-action-toolbar__action:disabled,.wf-widget-action-toolbar__menu-action:disabled{cursor:default;opacity:.45}.wf-widget-action-toolbar__action--accent{color:var(--wf-color-accent)}.wf-widget-action-toolbar__action--danger{color:var(--wf-color-danger)}.wf-widget-action-toolbar__action--pressed{background:var(--wf-color-selected);color:var(--wf-color-text)}.wf-widget-action-toolbar__label{max-width:10rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wf-widget-action-toolbar__more{display:grid;width:var(--wf-size-control-height);height:var(--wf-size-control-height);flex:0 0 auto;place-items:center;list-style:none}.wf-widget-action-toolbar--vertical .wf-widget-action-toolbar__more{width:100%}.wf-widget-action-toolbar__menu{position:fixed;z-index:var(--wf-layer-overlay);display:grid;max-width:min(320px,calc(100vw - 16px));max-height:calc(100vh - 16px);overflow:auto;gap:2px;padding:var(--wf-space-xs);border:1px solid var(--wf-color-border-floating);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface-floating);box-shadow:var(--wf-shadow-lg)}.wf-widget-action-toolbar__menu-action{display:flex;min-height:var(--wf-size-control-height);align-items:center;gap:var(--wf-space-sm);padding:0 var(--wf-space-sm);text-align:left}.wf-widget-action-toolbar__menu-action span:nth-child(2){flex:1}.wf-widget-action-toolbar__menu-action kbd{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs)}.wf-widget-action-toolbar--compact .wf-widget-action-toolbar__action{width:var(--wf-size-control-height);justify-content:center;padding:0}.wf-widget-action-toolbar__measurement{position:absolute;inset:0;display:flex;width:max-content;visibility:hidden;pointer-events:none;white-space:nowrap}.wf-widget-action-toolbar__measurement .wf-widget-action-toolbar__action{flex:0 0 auto}.wf-widget-action-toolbar__action--compact-measurement{width:var(--wf-size-control-height);justify-content:center;padding:0}
</style>
