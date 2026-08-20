<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { resolveWindowLayoutSpecs, validateWindowLayoutSpec, type WindowLayoutAnchor, type WindowLayoutAxis, type WindowLayoutAxisSpec, type WindowLayoutLength, type WindowLayoutSpec } from '../core/window-layout'
import type { WindowGeometry, WindowSize } from '../core/window-geometry'
import type { WindowState } from '../core/window-manager'
import { focusModal, trapFocus } from './modal-focus'

type LayoutMode = 'absolute' | 'responsive'
type TargetValue = 'none' | string
type PickerSide = 'left' | 'right' | 'top' | 'bottom'
type PickerAxis = 'horizontal' | 'vertical'
interface AxisDraft { startTarget: TargetValue; startOffset: number | string; startOffsetUnit: 'px' | 'percent'; endTarget: TargetValue; endOffset: number | string; endOffsetUnit: 'px' | 'percent'; size: number | string; sizeUnit: 'px' | 'percent'; fill: boolean }
interface TargetOption { readonly value: string; readonly label: string; readonly kind: 'workspace' | 'window' }
interface PickerRequest { readonly axis: PickerAxis; readonly side: PickerSide }

export interface WindowLayoutDialogSave { readonly layoutSpec: WindowLayoutSpec | null; readonly geometry: WindowGeometry }

const props = defineProps<{ open: boolean; window: WindowState; windows: readonly WindowState[]; container: WindowSize }>()
const emit = defineEmits<{ cancel: []; save: [value: WindowLayoutDialogSave] }>()
const dialog = ref<HTMLElement | null>(null)
const mode = ref<LayoutMode>('absolute')
const errorMessage = ref('')
const pickerRequest = ref<PickerRequest | null>(null)
const absolute = reactive({ x: 0 as number | string, y: 0 as number | string, width: 0 as number | string, height: 0 as number | string, xUnit: 'px' as 'px' | 'percent', yUnit: 'px' as 'px' | 'percent', widthUnit: 'px' as 'px' | 'percent', heightUnit: 'px' as 'px' | 'percent' })
const horizontal = reactive<AxisDraft>({ startTarget: 'workspace:left', startOffset: 0, startOffsetUnit: 'px', endTarget: 'none', endOffset: 0, endOffsetUnit: 'px', size: 0, sizeUnit: 'px', fill: false })
const vertical = reactive<AxisDraft>({ startTarget: 'workspace:top', startOffset: 0, startOffsetUnit: 'px', endTarget: 'none', endOffset: 0, endOffsetUnit: 'px', size: 0, sizeUnit: 'px', fill: false })
let previousFocus: HTMLElement | null = null

const otherWindows = computed(() => props.windows.filter((window) => window.instanceId !== props.window.instanceId))
const titleId = computed(() => `wf-window-layout-title-${props.window.instanceId}`)
const errorId = computed(() => `wf-window-layout-error-${props.window.instanceId}`)
const pickerLabel = computed(() => pickerRequest.value ? `Choose a window for ${pickerRequest.value.side} anchor` : '')

function targetOptions(axis: WindowLayoutAxis): readonly TargetOption[] {
  const edges = axis === 'horizontal' ? ['left', 'right'] : ['top', 'bottom']
  const workspace = edges.map((edge) => ({ value: `workspace:${edge}`, label: `Workspace · ${edge[0]?.toUpperCase()}${edge.slice(1)}`, kind: 'workspace' as const }))
  const windows = otherWindows.value.flatMap((window) => edges.map((edge) => ({ value: `window:${window.instanceId}:${edge}`, label: `${window.title} · ${window.instanceId} · ${edge}`, kind: 'window' as const })))
  return [...workspace, ...windows]
}
const horizontalTargets = computed(() => targetOptions('horizontal'))
const verticalTargets = computed(() => targetOptions('vertical'))

function readTarget(anchor: WindowLayoutAnchor | undefined): TargetValue {
  if (!anchor) return 'none'
  return anchor.target.kind === 'workspace' ? `workspace:${anchor.target.edge}` : `window:${anchor.target.instanceId}:${anchor.target.edge}`
}
function readLength(length: WindowLayoutLength | undefined, fallback: number): { value: number; unit: 'px' | 'percent' } { return length ? { value: length.value, unit: length.unit } : { value: fallback, unit: 'px' } }
function applyAxis(draft: AxisDraft, axisSpec: WindowLayoutAxisSpec | undefined, fallbackPosition: number, fallbackSize: number): void {
  const startLength = readLength(axisSpec?.start?.offset, fallbackPosition), endLength = readLength(axisSpec?.end?.offset, 0), sizeLength = axisSpec?.size === 'auto' || axisSpec?.size === undefined ? { value: fallbackSize, unit: 'px' as const } : readLength(axisSpec.size, fallbackSize)
  draft.startTarget = readTarget(axisSpec?.start); draft.startOffset = startLength.value; draft.startOffsetUnit = startLength.unit; draft.endTarget = readTarget(axisSpec?.end); draft.endOffset = endLength.value; draft.endOffsetUnit = endLength.unit; draft.size = sizeLength.value; draft.sizeUnit = sizeLength.unit; draft.fill = axisSpec?.size === 'auto' || (axisSpec?.size === undefined && axisSpec?.start !== undefined && axisSpec?.end !== undefined)
}
function initialize(): void {
  const geometry = props.window.geometry
  mode.value = props.window.layoutSpec ? 'responsive' : 'absolute'; errorMessage.value = ''; pickerRequest.value = null
  absolute.x = geometry.position.x; absolute.y = geometry.position.y; absolute.width = geometry.size.width; absolute.height = geometry.size.height; absolute.xUnit = 'px'; absolute.yUnit = 'px'; absolute.widthUnit = 'px'; absolute.heightUnit = 'px'
  applyAxis(horizontal, props.window.layoutSpec?.horizontal, geometry.position.x, geometry.size.width); applyAxis(vertical, props.window.layoutSpec?.vertical, geometry.position.y, geometry.size.height)
  if (!props.window.layoutSpec) { horizontal.startTarget = 'workspace:left'; horizontal.endTarget = 'none'; horizontal.fill = false; vertical.startTarget = 'workspace:top'; vertical.endTarget = 'none'; vertical.fill = false }
}
function numeric(value: number | string, label: string): number { const parsed = typeof value === 'number' ? value : Number(value); if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number`); return parsed }
function length(value: number | string, unit: 'px' | 'percent', label: string): WindowLayoutLength { return { value: numeric(value, label), unit } }
function parseTarget(value: TargetValue, axis: WindowLayoutAxis, offset: WindowLayoutLength): WindowLayoutAnchor | undefined {
  if (value === 'none') return undefined
  const parts = value.split(':'), edge = parts.at(-1)
  if (edge !== 'left' && edge !== 'right' && edge !== 'top' && edge !== 'bottom') throw new Error(`${axis} target has an invalid edge`)
  if (value.startsWith('workspace:')) return { target: { kind: 'workspace', edge }, offset }
  const instanceId = parts.slice(1, -1).join(':'); if (!instanceId) throw new Error(`${axis} target is missing a window id`)
  if (!otherWindows.value.some((window) => window.instanceId === instanceId)) throw new Error(`${axis} target window "${instanceId}" is no longer available`)
  return { target: { kind: 'window', instanceId, edge }, offset }
}
function writeAxis(draft: AxisDraft, axis: WindowLayoutAxis, label: string): WindowLayoutAxisSpec {
  const startOffset = length(draft.startOffset, draft.startOffsetUnit, `${label} left offset`), endOffset = length(draft.endOffset, draft.endOffsetUnit, `${label} right offset`), start = parseTarget(draft.startTarget, axis, startOffset), end = parseTarget(draft.endTarget, axis, endOffset), size = draft.fill ? 'auto' as const : length(draft.size, draft.sizeUnit, `${label} size`)
  return { ...(start ? { start } : {}), ...(end ? { end } : {}), size }
}
function absoluteGeometry(): WindowGeometry {
  const toPixels = (value: number | string, unit: 'px' | 'percent', available: number, label: string): number => unit === 'percent' ? available * numeric(value, label) / 100 : numeric(value, label)
  const geometry: WindowGeometry = { position: { x: toPixels(absolute.x, absolute.xUnit, props.container.width, 'X'), y: toPixels(absolute.y, absolute.yUnit, props.container.height, 'Y') }, size: { width: toPixels(absolute.width, absolute.widthUnit, props.container.width, 'Width'), height: toPixels(absolute.height, absolute.heightUnit, props.container.height, 'Height') } }
  if (geometry.size.width <= 0 || geometry.size.height <= 0) throw new Error('Width and height must be greater than zero')
  return geometry
}
function responsiveSpec(): WindowLayoutSpec {
  const spec: WindowLayoutSpec = { horizontal: writeAxis(horizontal, 'horizontal', 'Horizontal'), vertical: writeAxis(vertical, 'vertical', 'Vertical') }
  validateWindowLayoutSpec(spec, props.window.instanceId)
  resolveWindowLayoutSpecs(props.windows.map((window) => window.instanceId === props.window.instanceId ? { ...window, layoutSpec: spec } : window), props.container)
  return spec
}
function save(): void {
  try {
    if (mode.value === 'absolute') emit('save', { layoutSpec: null, geometry: absoluteGeometry() })
    else { const spec = responsiveSpec(), geometry = resolveWindowLayoutSpecs(props.windows.map((window) => window.instanceId === props.window.instanceId ? { ...window, layoutSpec: spec } : window), props.container).get(props.window.instanceId); if (!geometry) throw new Error('Window geometry could not be resolved'); emit('save', { layoutSpec: spec, geometry }) }
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'Invalid layout'
    errorMessage.value = /cycle/i.test(raw) ? 'This relationship would create a cycle.' : /unknown|no longer available|missing/i.test(raw) ? 'Choose an existing target window and anchor.' : /contradictory/i.test(raw) ? 'The right/bottom anchor must be after the left/top anchor.' : raw
  }
}
function clearPickerMarkers(): void { for (const element of document.querySelectorAll<HTMLElement>('[data-layout-picker-source], [data-layout-picker-target]')) { delete element.dataset.layoutPickerSource; delete element.dataset.layoutPickerTarget } }
function markPickerSource(): void { clearPickerMarkers(); const source = [...document.querySelectorAll<HTMLElement>('[data-window-instance-id]')].find((element) => element.dataset.windowInstanceId === props.window.instanceId); if (source) source.dataset.layoutPickerSource = 'true' }
function cancel(): void { pickerRequest.value = null; clearPickerMarkers(); emit('cancel') }
function handleBackdrop(event: MouseEvent): void { if (event.target === event.currentTarget && !pickerRequest.value) cancel() }
function handleKeydown(event: KeyboardEvent): void { if (event.key === 'Escape') { event.preventDefault(); if (pickerRequest.value) { pickerRequest.value = null; clearPickerMarkers() } else cancel(); return } if (event.key === 'Tab' && dialog.value) { event.preventDefault(); trapFocus(dialog.value, event.shiftKey) } }
function startPicker(axis: PickerAxis, side: PickerSide): void { pickerRequest.value = { axis, side }; errorMessage.value = ''; markPickerSource() }
function draftFor(axis: PickerAxis): AxisDraft { return axis === 'horizontal' ? horizontal : vertical }
function setTargetValue(axis: PickerAxis, side: PickerSide, value: TargetValue): void { const draft = draftFor(axis); if (side === 'left' || side === 'top') draft.startTarget = value; else draft.endTarget = value }
function onDocumentPointerDown(event: PointerEvent): void {
  const request = pickerRequest.value; if (!request) return
  const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-window-instance-id]') : null, instanceId = element?.dataset.windowInstanceId
  if (!instanceId || instanceId === props.window.instanceId || !otherWindows.value.some((window) => window.instanceId === instanceId)) return
  const edge = request.side === 'left' ? 'right' : request.side === 'right' ? 'left' : request.side === 'top' ? 'bottom' : 'top'
  setTargetValue(request.axis, request.side, `window:${instanceId}:${edge}`); clearPickerMarkers(); element.dataset.layoutPickerTarget = 'true'; pickerRequest.value = null; event.preventDefault()
}
watch(() => props.open, async (open) => { if (open) { previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null; initialize(); await nextTick(); if (dialog.value) focusModal(dialog.value) } else { const restore = previousFocus; previousFocus = null; await nextTick(); restore?.focus() } }, { immediate: true })
watch(() => props.window.instanceId, () => { if (props.open) initialize() })
onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown, true))
onBeforeUnmount(() => { document.removeEventListener('pointerdown', onDocumentPointerDown, true); clearPickerMarkers(); const restore = previousFocus; previousFocus = null; restore?.focus() })
</script>

<template>
  <div v-if="props.open" class="wf-window-layout-backdrop" :class="{ 'wf-window-layout-backdrop--picking': pickerRequest }" @mousedown="handleBackdrop">
    <section ref="dialog" class="wf-window-layout-dialog" role="dialog" aria-modal="true" :aria-labelledby="titleId" :aria-describedby="errorMessage ? errorId : undefined" @keydown.stop="handleKeydown">
      <header class="wf-window-layout-dialog__header">
        <div><strong :id="titleId">Layout bearbeiten</strong><small>{{ props.window.title }} · {{ props.window.instanceId }}</small></div>
        <button type="button" class="wf-window-layout-dialog__close" aria-label="Cancel" @click="cancel">×</button>
      </header>
      <form class="wf-window-layout-dialog__body" @submit.prevent="save">
        <p class="wf-window-layout-dialog__resolved" data-layout-resolved>Current: X {{ Math.round(props.window.geometry.position.x) }} · Y {{ Math.round(props.window.geometry.position.y) }} · {{ Math.round(props.window.geometry.size.width) }} × {{ Math.round(props.window.geometry.size.height) }} px</p>
        <fieldset><legend>Layout type</legend><label><input v-model="mode" type="radio" value="absolute" /> Free geometry</label><label><input v-model="mode" type="radio" value="responsive" /> Anchored / responsive layout</label></fieldset>
        <div v-if="mode === 'absolute'" class="wf-window-layout-dialog__grid">
          <label>X <input v-model="absolute.x" type="number" step="any" inputmode="decimal" data-layout-x /><select v-model="absolute.xUnit" aria-label="X unit"><option value="px">px</option><option value="percent">%</option></select></label>
          <label>Y <input v-model="absolute.y" type="number" step="any" inputmode="decimal" data-layout-y /><select v-model="absolute.yUnit" aria-label="Y unit"><option value="px">px</option><option value="percent">%</option></select></label>
          <label>Width <input v-model="absolute.width" type="number" step="any" min="0" inputmode="decimal" data-layout-width /><select v-model="absolute.widthUnit" aria-label="Width unit"><option value="px">px</option><option value="percent">%</option></select></label>
          <label>Height <input v-model="absolute.height" type="number" step="any" min="0" inputmode="decimal" data-layout-height /><select v-model="absolute.heightUnit" aria-label="Height unit"><option value="px">px</option><option value="percent">%</option></select></label>
        </div>
        <template v-else>
          <fieldset>
            <legend>Horizontal · Left / Right / Width</legend>
            <label>Left <select v-model="horizontal.startTarget" data-layout-left-target data-layout-horizontal-start><option value="none">Not anchored</option><optgroup label="Workspace"><option v-for="target in horizontalTargets.filter((target) => target.kind === 'workspace')" :key="target.value" :value="target.value">{{ target.label }}</option></optgroup><optgroup label="Windows"><option v-for="target in horizontalTargets.filter((target) => target.kind === 'window')" :key="target.value" :value="target.value">{{ target.label }}</option></optgroup></select><button type="button" data-layout-pick="horizontal:left" @click="startPicker('horizontal', 'left')">Auf Canvas wählen</button></label>
            <label>Left offset <input v-model="horizontal.startOffset" type="number" step="any" data-layout-left-offset /><select v-model="horizontal.startOffsetUnit" aria-label="Left offset unit"><option value="px">px</option><option value="percent">%</option></select></label>
            <label>Right <select v-model="horizontal.endTarget" data-layout-right-target data-layout-horizontal-end><option value="none">Not anchored</option><optgroup label="Workspace"><option v-for="target in horizontalTargets.filter((target) => target.kind === 'workspace')" :key="target.value" :value="target.value">{{ target.label }}</option></optgroup><optgroup label="Windows"><option v-for="target in horizontalTargets.filter((target) => target.kind === 'window')" :key="target.value" :value="target.value">{{ target.label }}</option></optgroup></select><button type="button" data-layout-pick="horizontal:right" @click="startPicker('horizontal', 'right')">Auf Canvas wählen</button></label>
            <label>Right offset <input v-model="horizontal.endOffset" type="number" step="any" data-layout-right-offset /><select v-model="horizontal.endOffsetUnit" aria-label="Right offset unit"><option value="px">px</option><option value="percent">%</option></select></label>
            <label>Width <input v-model="horizontal.size" type="number" step="any" :disabled="horizontal.fill" data-layout-width /><select v-model="horizontal.sizeUnit" aria-label="Width unit" :disabled="horizontal.fill"><option value="px">px</option><option value="percent">%</option></select></label>
            <label class="wf-window-layout-dialog__check"><input v-model="horizontal.fill" type="checkbox" data-layout-horizontal-fill /> Fill between Left and Right</label><small v-if="horizontal.fill" class="wf-window-layout-dialog__hint" data-layout-fill-hint>Width is calculated from both anchors.</small>
          </fieldset>
          <fieldset>
            <legend>Vertical · Top / Bottom / Height</legend>
            <label>Top <select v-model="vertical.startTarget" data-layout-top-target data-layout-vertical-start><option value="none">Not anchored</option><optgroup label="Workspace"><option v-for="target in verticalTargets.filter((target) => target.kind === 'workspace')" :key="target.value" :value="target.value">{{ target.label }}</option></optgroup><optgroup label="Windows"><option v-for="target in verticalTargets.filter((target) => target.kind === 'window')" :key="target.value" :value="target.value">{{ target.label }}</option></optgroup></select><button type="button" data-layout-pick="vertical:top" @click="startPicker('vertical', 'top')">Auf Canvas wählen</button></label>
            <label>Top offset <input v-model="vertical.startOffset" type="number" step="any" /><select v-model="vertical.startOffsetUnit" aria-label="Top offset unit"><option value="px">px</option><option value="percent">%</option></select></label>
            <label>Bottom <select v-model="vertical.endTarget" data-layout-bottom-target data-layout-vertical-end><option value="none">Not anchored</option><optgroup label="Workspace"><option v-for="target in verticalTargets.filter((target) => target.kind === 'workspace')" :key="target.value" :value="target.value">{{ target.label }}</option></optgroup><optgroup label="Windows"><option v-for="target in verticalTargets.filter((target) => target.kind === 'window')" :key="target.value" :value="target.value">{{ target.label }}</option></optgroup></select><button type="button" data-layout-pick="vertical:bottom" @click="startPicker('vertical', 'bottom')">Auf Canvas wählen</button></label>
            <label>Bottom offset <input v-model="vertical.endOffset" type="number" step="any" /><select v-model="vertical.endOffsetUnit" aria-label="Bottom offset unit"><option value="px">px</option><option value="percent">%</option></select></label>
            <label>Height <input v-model="vertical.size" type="number" step="any" :disabled="vertical.fill" data-layout-height /><select v-model="vertical.sizeUnit" aria-label="Height unit" :disabled="vertical.fill"><option value="px">px</option><option value="percent">%</option></select></label>
            <label class="wf-window-layout-dialog__check"><input v-model="vertical.fill" type="checkbox" data-layout-vertical-fill /> Fill between Top and Bottom</label><small v-if="vertical.fill" class="wf-window-layout-dialog__hint" data-layout-fill-hint>Height is calculated from both anchors.</small>
          </fieldset>
          <p class="wf-window-layout-dialog__summary" data-layout-relationship-summary>Left {{ horizontal.startTarget === 'none' ? 'free' : horizontal.startTarget }} · Right {{ horizontal.endTarget === 'none' ? 'free' : horizontal.endTarget }} · Top {{ vertical.startTarget === 'none' ? 'free' : vertical.startTarget }} · Bottom {{ vertical.endTarget === 'none' ? 'free' : vertical.endTarget }}</p>
          <p v-if="pickerRequest" class="wf-window-layout-dialog__picker" data-layout-picker-state role="status">{{ pickerLabel }} — click a highlighted window in the workspace. Press Escape to cancel.</p>
        </template>
        <p v-if="errorMessage" :id="errorId" class="wf-window-layout-dialog__error" role="alert">{{ errorMessage }}</p>
        <footer class="wf-window-layout-dialog__actions"><button type="button" @click="cancel">Cancel</button><button type="submit" data-layout-save>Save layout</button></footer>
      </form>
    </section>
  </div>
</template>

<style scoped>
.wf-window-layout-backdrop { position: fixed; inset: 0; z-index: var(--wf-layer-overlay); display: grid; place-items: center; padding: var(--wf-space-lg); background: var(--wf-color-backdrop); }
.wf-window-layout-backdrop--picking { pointer-events: none; background: color-mix(in srgb, var(--wf-color-backdrop) 18%, transparent); }
.wf-window-layout-dialog { width: min(860px, 100%); max-height: min(820px, 100%); overflow: auto; pointer-events: auto; border: 1px solid var(--wf-color-border-modal); border-radius: var(--wf-radius-md); background: var(--wf-color-surface-modal); color: var(--wf-color-text); box-shadow: var(--wf-shadow-lg); }
.wf-window-layout-dialog__header { display: flex; justify-content: space-between; gap: var(--wf-space-md); padding: var(--wf-space-md) var(--wf-space-lg); border-bottom: 1px solid var(--wf-color-border-modal); }
.wf-window-layout-dialog__header div { display: grid; gap: var(--wf-space-xs); }
.wf-window-layout-dialog__header small, .wf-window-layout-dialog__resolved { color: var(--wf-color-text-muted); font-size: var(--wf-font-size-sm); }
.wf-window-layout-dialog__close { border: 0; background: transparent; color: var(--wf-color-text); font: inherit; font-size: 1.4em; cursor: pointer; }
.wf-window-layout-dialog__body { display: grid; gap: var(--wf-space-md); padding: var(--wf-space-lg); }
.wf-window-layout-dialog fieldset { display: grid; gap: var(--wf-space-sm); min-width: 0; padding: var(--wf-space-md); border: 1px solid var(--wf-color-border); border-radius: var(--wf-radius-sm); }
.wf-window-layout-dialog legend { padding: 0 var(--wf-space-xs); color: var(--wf-color-text-muted); font-size: var(--wf-font-size-sm); }
.wf-window-layout-dialog label { display: grid; grid-template-columns: minmax(100px, .6fr) minmax(180px, 1.6fr) auto; align-items: center; gap: var(--wf-space-xs); font-size: var(--wf-font-size-sm); }
.wf-window-layout-dialog fieldset > label:has(input[type="radio"]), .wf-window-layout-dialog__check { display: flex; }
.wf-window-layout-dialog input, .wf-window-layout-dialog select { min-height: var(--wf-size-control-height-compact); min-width: 0; border: 1px solid var(--wf-color-border); border-radius: var(--wf-radius-sm); background: var(--wf-color-surface); color: var(--wf-color-text); font: inherit; padding: 0 var(--wf-space-xs); }
.wf-window-layout-dialog select { width: 100%; }
.wf-window-layout-dialog button { min-height: var(--wf-size-control-height-compact); border: 1px solid var(--wf-color-border); border-radius: var(--wf-radius-sm); background: transparent; color: var(--wf-color-text); font: inherit; cursor: pointer; }
.wf-window-layout-dialog button:hover { background: var(--wf-color-hover); }
.wf-window-layout-dialog__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--wf-space-md); }
.wf-window-layout-dialog__grid label { grid-template-columns: auto minmax(0, 1fr) auto; }
.wf-window-layout-dialog__hint, .wf-window-layout-dialog__summary, .wf-window-layout-dialog__picker { margin: 0; color: var(--wf-color-text-muted); font-size: var(--wf-font-size-sm); }
.wf-window-layout-dialog__picker { padding: var(--wf-space-sm); border-left: 3px solid var(--wf-color-focus); color: var(--wf-color-accent); }
.wf-window-layout-dialog__error { margin: 0; padding: var(--wf-space-sm); border-left: 3px solid var(--wf-color-danger); color: var(--wf-color-danger); }
.wf-window-layout-dialog__actions { display: flex; justify-content: flex-end; gap: var(--wf-space-sm); }
.wf-window-layout-dialog__actions button { padding: 0 var(--wf-space-md); }
.wf-window-layout-dialog__actions button:last-child { border-color: var(--wf-color-accent); color: var(--wf-color-accent); }
.wf-window-layout-dialog button:focus-visible, .wf-window-layout-dialog input:focus-visible, .wf-window-layout-dialog select:focus-visible { outline: 2px solid var(--wf-color-focus); outline-offset: 2px; }
@media (max-width: 720px) { .wf-window-layout-dialog__grid { grid-template-columns: 1fr; } .wf-window-layout-dialog label { grid-template-columns: 1fr; } }
</style>
