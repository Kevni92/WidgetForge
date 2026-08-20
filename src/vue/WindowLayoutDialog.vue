<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { resolveWindowLayoutSpecs, validateWindowLayoutSpec, type WindowLayoutAnchor, type WindowLayoutAxis, type WindowLayoutAxisSpec, type WindowLayoutLength, type WindowLayoutSpec } from '../core/window-layout'
import type { WindowGeometry, WindowSize } from '../core/window-geometry'
import type { WindowState } from '../core/window-manager'
import { focusModal, trapFocus } from './modal-focus'

type LayoutMode = 'absolute' | 'responsive'
type TargetValue = 'none' | string

interface AxisDraft {
  startTarget: TargetValue
  startOffset: number | string
  startOffsetUnit: 'px' | 'percent'
  endTarget: TargetValue
  endOffset: number | string
  endOffsetUnit: 'px' | 'percent'
  size: number | string
  sizeUnit: 'px' | 'percent'
  fill: boolean
}

export interface WindowLayoutDialogSave {
  readonly layoutSpec: WindowLayoutSpec | null
  readonly geometry: WindowGeometry
}

const props = defineProps<{
  open: boolean
  window: WindowState
  windows: readonly WindowState[]
  container: WindowSize
}>()

const emit = defineEmits<{
  cancel: []
  save: [value: WindowLayoutDialogSave]
}>()

const dialog = ref<HTMLElement | null>(null)
const mode = ref<LayoutMode>('absolute')
const errorMessage = ref('')
const absolute = reactive({ x: 0 as number | string, y: 0 as number | string, width: 0 as number | string, height: 0 as number | string, xUnit: 'px' as 'px' | 'percent', yUnit: 'px' as 'px' | 'percent', widthUnit: 'px' as 'px' | 'percent', heightUnit: 'px' as 'px' | 'percent' })
const horizontal = reactive<AxisDraft>({ startTarget: 'workspace:left', startOffset: 0, startOffsetUnit: 'px', endTarget: 'none', endOffset: 0, endOffsetUnit: 'px', size: 0, sizeUnit: 'px', fill: false })
const vertical = reactive<AxisDraft>({ startTarget: 'workspace:top', startOffset: 0, startOffsetUnit: 'px', endTarget: 'none', endOffset: 0, endOffsetUnit: 'px', size: 0, sizeUnit: 'px', fill: false })
let previousFocus: HTMLElement | null = null

const otherWindows = computed(() => props.windows.filter((window) => window.instanceId !== props.window.instanceId))
const horizontalTargets = computed(() => targetOptions('horizontal'))
const verticalTargets = computed(() => targetOptions('vertical'))
const titleId = computed(() => `wf-window-layout-title-${props.window.instanceId}`)
const errorId = computed(() => `wf-window-layout-error-${props.window.instanceId}`)

function targetOptions(axis: WindowLayoutAxis): readonly { value: string; label: string }[] {
  const edges = axis === 'horizontal' ? ['left', 'right'] : ['top', 'bottom']
  const options = edges.map((edge) => ({ value: `workspace:${edge}`, label: `Workspace ${edge}` }))
  for (const window of otherWindows.value) for (const edge of edges) options.push({ value: `window:${window.instanceId}:${edge}`, label: `${window.title} (${window.instanceId}) ${edge}` })
  return options
}

function readTarget(anchor: WindowLayoutAnchor | undefined): TargetValue {
  if (!anchor) return 'none'
  return anchor.target.kind === 'workspace' ? `workspace:${anchor.target.edge}` : `window:${anchor.target.instanceId}:${anchor.target.edge}`
}

function readLength(length: WindowLayoutLength | undefined, fallback: number): { value: number; unit: 'px' | 'percent' } {
  return length ? { value: length.value, unit: length.unit } : { value: fallback, unit: 'px' }
}

function applyAxis(draft: AxisDraft, axisSpec: WindowLayoutAxisSpec | undefined, fallbackPosition: number, fallbackSize: number): void {
  const startLength = readLength(axisSpec?.start?.offset, fallbackPosition)
  const endLength = readLength(axisSpec?.end?.offset, 0)
  const sizeLength = axisSpec?.size === 'auto' || axisSpec?.size === undefined ? { value: fallbackSize, unit: 'px' as const } : readLength(axisSpec.size, fallbackSize)
  draft.startTarget = readTarget(axisSpec?.start)
  draft.startOffset = startLength.value
  draft.startOffsetUnit = startLength.unit
  draft.endTarget = readTarget(axisSpec?.end)
  draft.endOffset = endLength.value
  draft.endOffsetUnit = endLength.unit
  draft.size = sizeLength.value
  draft.sizeUnit = sizeLength.unit
  draft.fill = axisSpec?.size === 'auto' || (axisSpec?.size === undefined && axisSpec?.start !== undefined && axisSpec?.end !== undefined)
}

function initialize(): void {
  const geometry = props.window.geometry
  mode.value = props.window.layoutSpec ? 'responsive' : 'absolute'
  errorMessage.value = ''
  absolute.x = geometry.position.x
  absolute.y = geometry.position.y
  absolute.width = geometry.size.width
  absolute.height = geometry.size.height
  absolute.xUnit = 'px'
  absolute.yUnit = 'px'
  absolute.widthUnit = 'px'
  absolute.heightUnit = 'px'
  applyAxis(horizontal, props.window.layoutSpec?.horizontal, geometry.position.x, geometry.size.width)
  applyAxis(vertical, props.window.layoutSpec?.vertical, geometry.position.y, geometry.size.height)
  if (!props.window.layoutSpec) {
    horizontal.startTarget = 'workspace:left'
    horizontal.endTarget = 'none'
    horizontal.fill = false
    vertical.startTarget = 'workspace:top'
    vertical.endTarget = 'none'
    vertical.fill = false
  }
}

function numeric(value: number | string, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number`)
  return parsed
}

function length(value: number | string, unit: 'px' | 'percent', label: string): WindowLayoutLength {
  return { value: numeric(value, label), unit }
}

function parseTarget(value: TargetValue, axis: WindowLayoutAxis, offset: WindowLayoutLength): WindowLayoutAnchor | undefined {
  if (value === 'none') return undefined
  const parts = value.split(':')
  const edge = parts.at(-1)
  if (edge !== 'left' && edge !== 'right' && edge !== 'top' && edge !== 'bottom') throw new Error(`${axis} target has an invalid edge`)
  if (value.startsWith('workspace:')) return { target: { kind: 'workspace', edge }, offset }
  const instanceId = parts.slice(1, -1).join(':')
  if (!instanceId) throw new Error(`${axis} target is missing a window id`)
  return { target: { kind: 'window', instanceId, edge }, offset }
}

function writeAxis(draft: AxisDraft, axis: WindowLayoutAxis, label: string): WindowLayoutAxisSpec {
  const startOffset = length(draft.startOffset, draft.startOffsetUnit, `${label} start offset`)
  const endOffset = length(draft.endOffset, draft.endOffsetUnit, `${label} end offset`)
  const start = parseTarget(draft.startTarget, axis, startOffset)
  const end = parseTarget(draft.endTarget, axis, endOffset)
  const size = draft.fill ? 'auto' as const : length(draft.size, draft.sizeUnit, `${label} size`)
  return { ...(start ? { start } : {}), ...(end ? { end } : {}), size }
}

function absoluteGeometry(): WindowGeometry {
  const width = props.container.width
  const height = props.container.height
  const toPixels = (value: number | string, unit: 'px' | 'percent', available: number, label: string): number => unit === 'percent' ? available * numeric(value, label) / 100 : numeric(value, label)
  const geometry: WindowGeometry = { position: { x: toPixels(absolute.x, absolute.xUnit, width, 'X'), y: toPixels(absolute.y, absolute.yUnit, height, 'Y') }, size: { width: toPixels(absolute.width, absolute.widthUnit, width, 'Width'), height: toPixels(absolute.height, absolute.heightUnit, height, 'Height') } }
  if (geometry.size.width <= 0 || geometry.size.height <= 0) throw new Error('Width and height must be greater than zero')
  return geometry
}

function responsiveSpec(): WindowLayoutSpec {
  const spec: WindowLayoutSpec = { horizontal: writeAxis(horizontal, 'horizontal', 'Horizontal'), vertical: writeAxis(vertical, 'vertical', 'Vertical') }
  validateWindowLayoutSpec(spec, props.window.instanceId)
  const candidates = props.windows.map((window) => window.instanceId === props.window.instanceId ? { ...window, layoutSpec: spec } : window)
  resolveWindowLayoutSpecs(candidates, props.container)
  return spec
}

function save(): void {
  try {
    if (mode.value === 'absolute') emit('save', { layoutSpec: null, geometry: absoluteGeometry() })
    else {
      const spec = responsiveSpec()
      const geometry = resolveWindowLayoutSpecs(props.windows.map((window) => window.instanceId === props.window.instanceId ? { ...window, layoutSpec: spec } : window), props.container).get(props.window.instanceId)
      if (!geometry) throw new Error('Window geometry could not be resolved')
      emit('save', { layoutSpec: spec, geometry })
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Invalid layout'
  }
}

function cancel(): void { emit('cancel') }
function handleBackdrop(event: MouseEvent): void { if (event.target === event.currentTarget) cancel() }
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') { event.preventDefault(); cancel(); return }
  if (event.key === 'Tab' && dialog.value) { event.preventDefault(); trapFocus(dialog.value, event.shiftKey) }
}

watch(() => props.open, async (open) => {
  if (open) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    initialize()
    await nextTick()
    if (dialog.value) focusModal(dialog.value)
    return
  }
  const restore = previousFocus
  previousFocus = null
  await nextTick()
  restore?.focus()
}, { immediate: true })
watch(() => props.window.instanceId, () => { if (props.open) initialize() })
onBeforeUnmount(() => {
  const restore = previousFocus
  previousFocus = null
  restore?.focus()
})
</script>

<template>
  <div v-if="props.open" class="wf-window-layout-backdrop" @mousedown="handleBackdrop">
    <section ref="dialog" class="wf-window-layout-dialog" role="dialog" aria-modal="true" :aria-labelledby="titleId" :aria-describedby="errorMessage ? errorId : undefined" @keydown.stop="handleKeydown">
      <header class="wf-window-layout-dialog__header">
        <div>
          <strong :id="titleId">Layout…</strong>
          <small>{{ props.window.title }} · {{ props.window.instanceId }}</small>
        </div>
        <button type="button" class="wf-window-layout-dialog__close" aria-label="Cancel" @click="cancel">×</button>
      </header>
      <form class="wf-window-layout-dialog__body" @submit.prevent="save">
        <p class="wf-window-layout-dialog__resolved">Resolved: X {{ Math.round(props.window.geometry.position.x) }} · Y {{ Math.round(props.window.geometry.position.y) }} · {{ Math.round(props.window.geometry.size.width) }} × {{ Math.round(props.window.geometry.size.height) }} px</p>
        <fieldset>
          <legend>Mode</legend>
          <label><input v-model="mode" type="radio" value="absolute" /> Absolute</label>
          <label><input v-model="mode" type="radio" value="responsive" /> Responsive</label>
        </fieldset>

        <div v-if="mode === 'absolute'" class="wf-window-layout-dialog__grid">
          <label>X <input v-model="absolute.x" type="number" step="any" inputmode="decimal" data-layout-x /><select v-model="absolute.xUnit" aria-label="X unit"><option value="px">px</option><option value="percent">%</option></select></label>
          <label>Y <input v-model="absolute.y" type="number" step="any" inputmode="decimal" data-layout-y /><select v-model="absolute.yUnit" aria-label="Y unit"><option value="px">px</option><option value="percent">%</option></select></label>
          <label>Width <input v-model="absolute.width" type="number" step="any" min="0" inputmode="decimal" data-layout-width /><select v-model="absolute.widthUnit" aria-label="Width unit"><option value="px">px</option><option value="percent">%</option></select></label>
          <label>Height <input v-model="absolute.height" type="number" step="any" min="0" inputmode="decimal" data-layout-height /><select v-model="absolute.heightUnit" aria-label="Height unit"><option value="px">px</option><option value="percent">%</option></select></label>
        </div>

        <template v-else>
          <fieldset>
            <legend>Horizontal</legend>
            <label>Start <select v-model="horizontal.startTarget" data-layout-horizontal-start><option value="none">None</option><option v-for="target in horizontalTargets" :key="target.value" :value="target.value">{{ target.label }}</option></select></label>
            <label>Start offset <input v-model="horizontal.startOffset" type="number" step="any" /><select v-model="horizontal.startOffsetUnit" aria-label="Horizontal start offset unit"><option value="px">px</option><option value="percent">%</option></select></label>
            <label>End <select v-model="horizontal.endTarget" data-layout-horizontal-end><option value="none">None</option><option v-for="target in horizontalTargets" :key="target.value" :value="target.value">{{ target.label }}</option></select></label>
            <label>End offset <input v-model="horizontal.endOffset" type="number" step="any" /><select v-model="horizontal.endOffsetUnit" aria-label="Horizontal end offset unit"><option value="px">px</option><option value="percent">%</option></select></label>
            <label>Width <input v-model="horizontal.size" type="number" step="any" :disabled="horizontal.fill" /><select v-model="horizontal.sizeUnit" aria-label="Horizontal size unit" :disabled="horizontal.fill"><option value="px">px</option><option value="percent">%</option></select></label>
            <label><input v-model="horizontal.fill" type="checkbox" /> Fill between anchors</label>
          </fieldset>
          <fieldset>
            <legend>Vertical</legend>
            <label>Start <select v-model="vertical.startTarget" data-layout-vertical-start><option value="none">None</option><option v-for="target in verticalTargets" :key="target.value" :value="target.value">{{ target.label }}</option></select></label>
            <label>Start offset <input v-model="vertical.startOffset" type="number" step="any" /><select v-model="vertical.startOffsetUnit" aria-label="Vertical start offset unit"><option value="px">px</option><option value="percent">%</option></select></label>
            <label>End <select v-model="vertical.endTarget" data-layout-vertical-end><option value="none">None</option><option v-for="target in verticalTargets" :key="target.value" :value="target.value">{{ target.label }}</option></select></label>
            <label>End offset <input v-model="vertical.endOffset" type="number" step="any" /><select v-model="vertical.endOffsetUnit" aria-label="Vertical end offset unit"><option value="px">px</option><option value="percent">%</option></select></label>
            <label>Height <input v-model="vertical.size" type="number" step="any" :disabled="vertical.fill" /><select v-model="vertical.sizeUnit" aria-label="Vertical size unit" :disabled="vertical.fill"><option value="px">px</option><option value="percent">%</option></select></label>
            <label><input v-model="vertical.fill" type="checkbox" /> Fill between anchors</label>
          </fieldset>
        </template>
        <p v-if="errorMessage" :id="errorId" class="wf-window-layout-dialog__error" role="alert">{{ errorMessage }}</p>
        <footer class="wf-window-layout-dialog__actions">
          <button type="button" @click="cancel">Cancel</button>
          <button type="submit" data-layout-save>Save</button>
        </footer>
      </form>
    </section>
  </div>
</template>

<style scoped>
.wf-window-layout-backdrop { position: fixed; inset: 0; z-index: var(--wf-layer-overlay); display: grid; place-items: center; padding: var(--wf-space-lg); background: var(--wf-color-backdrop); }
.wf-window-layout-dialog { width: min(720px, 100%); max-height: min(760px, 100%); overflow: auto; border: 1px solid var(--wf-color-border-modal); border-radius: var(--wf-radius-md); background: var(--wf-color-surface-modal); color: var(--wf-color-text); box-shadow: var(--wf-shadow-lg); }
.wf-window-layout-dialog__header { display: flex; justify-content: space-between; gap: var(--wf-space-md); padding: var(--wf-space-md) var(--wf-space-lg); border-bottom: 1px solid var(--wf-color-border-modal); }
.wf-window-layout-dialog__header div { display: grid; gap: var(--wf-space-xs); }
.wf-window-layout-dialog__header small, .wf-window-layout-dialog__resolved { color: var(--wf-color-text-muted); font-size: var(--wf-font-size-sm); }
.wf-window-layout-dialog__close { border: 0; background: transparent; color: var(--wf-color-text); font: inherit; font-size: 1.4em; cursor: pointer; }
.wf-window-layout-dialog__body { display: grid; gap: var(--wf-space-md); padding: var(--wf-space-lg); }
.wf-window-layout-dialog fieldset { display: grid; gap: var(--wf-space-sm); min-width: 0; padding: var(--wf-space-md); border: 1px solid var(--wf-color-border); border-radius: var(--wf-radius-sm); }
.wf-window-layout-dialog legend { padding: 0 var(--wf-space-xs); color: var(--wf-color-text-muted); font-size: var(--wf-font-size-sm); }
.wf-window-layout-dialog label { display: grid; grid-template-columns: minmax(90px, 1fr) minmax(100px, 1.5fr) auto; align-items: center; gap: var(--wf-space-xs); font-size: var(--wf-font-size-sm); }
.wf-window-layout-dialog fieldset > label:has(input[type="radio"]), .wf-window-layout-dialog fieldset > label:has(input[type="checkbox"]) { display: flex; }
.wf-window-layout-dialog input, .wf-window-layout-dialog select { min-height: var(--wf-size-control-height-compact); min-width: 0; border: 1px solid var(--wf-color-border); border-radius: var(--wf-radius-sm); background: var(--wf-color-surface); color: var(--wf-color-text); font: inherit; padding: 0 var(--wf-space-xs); }
.wf-window-layout-dialog__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--wf-space-md); }
.wf-window-layout-dialog__grid label { grid-template-columns: auto minmax(0, 1fr) auto; }
.wf-window-layout-dialog__error { margin: 0; padding: var(--wf-space-sm); border-left: 3px solid var(--wf-color-danger); color: var(--wf-color-danger); }
.wf-window-layout-dialog__actions { display: flex; justify-content: flex-end; gap: var(--wf-space-sm); }
.wf-window-layout-dialog__actions button { min-height: var(--wf-size-control-height-compact); padding: 0 var(--wf-space-md); border: 1px solid var(--wf-color-border); border-radius: var(--wf-radius-sm); background: transparent; color: var(--wf-color-text); font: inherit; cursor: pointer; }
.wf-window-layout-dialog__actions button:last-child { border-color: var(--wf-color-accent); color: var(--wf-color-accent); }
.wf-window-layout-dialog button:focus-visible, .wf-window-layout-dialog input:focus-visible, .wf-window-layout-dialog select:focus-visible { outline: 2px solid var(--wf-color-focus); outline-offset: 2px; }
@media (max-width: 600px) { .wf-window-layout-dialog__grid { grid-template-columns: 1fr; } .wf-window-layout-dialog label { grid-template-columns: 1fr; } }
</style>
