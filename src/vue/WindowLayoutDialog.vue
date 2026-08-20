<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { convertWindowLayoutValue, deriveWindowLayoutAxisMode, resolveWindowLayoutSpecs, validateWindowLayoutSpec, type WindowLayoutAnchor, type WindowLayoutAxis, type WindowLayoutAxisMode, type WindowLayoutAxisSpec, type WindowLayoutLength, type WindowLayoutSpec } from '../core/window-layout'
import type { WindowGeometry, WindowSize } from '../core/window-geometry'
import type { WindowState } from '../core/window-manager'
import { focusModal, trapFocus } from './modal-focus'

type LayoutMode = 'absolute' | 'responsive'
type TargetValue = 'none' | string
type PickerSide = 'left' | 'right' | 'top' | 'bottom'
type PickerAxis = 'horizontal' | 'vertical'
interface AxisDraft { mode: WindowLayoutAxisMode; startTarget: TargetValue; startOffset: number | string; startOffsetUnit: 'px' | 'percent'; endTarget: TargetValue; endOffset: number | string; endOffsetUnit: 'px' | 'percent'; size: number | string; sizeUnit: 'px' | 'percent' }
interface TargetOption { readonly value: string; readonly label: string; readonly kind: 'workspace' | 'window' }
interface PickerRequest { readonly axis: PickerAxis; readonly side: PickerSide }

export interface WindowLayoutDialogSave { readonly layoutSpec: WindowLayoutSpec | null; readonly geometry: WindowGeometry }
export interface WindowLayoutDialogPreview { readonly sourceInstanceId: string; readonly layoutSpec: WindowLayoutSpec | null; readonly geometry: WindowGeometry }

const props = defineProps<{ open: boolean; window: WindowState; windows: readonly WindowState[]; container: WindowSize }>()
const emit = defineEmits<{ cancel: []; preview: [value: WindowLayoutDialogPreview | null]; save: [value: WindowLayoutDialogSave] }>()
const dialog = ref<HTMLElement | null>(null)
const mode = ref<LayoutMode>('absolute')
const errorMessage = ref('')
const noticeMessage = ref('')
const retainedChoice = ref<'retained' | 'current' | null>(null)
const previewGeometry = ref<WindowGeometry | null>(null)
const previewError = ref('')
const pickerRequest = ref<PickerRequest | null>(null)
const absolute = reactive({ x: 0 as number | string, y: 0 as number | string, width: 0 as number | string, height: 0 as number | string, xUnit: 'px' as 'px' | 'percent', yUnit: 'px' as 'px' | 'percent', widthUnit: 'px' as 'px' | 'percent', heightUnit: 'px' as 'px' | 'percent' })
const horizontal = reactive<AxisDraft>({ mode: 'start-size', startTarget: 'workspace:left', startOffset: 0, startOffsetUnit: 'px', endTarget: 'none', endOffset: 0, endOffsetUnit: 'px', size: 0, sizeUnit: 'px' })
const vertical = reactive<AxisDraft>({ mode: 'start-size', startTarget: 'workspace:top', startOffset: 0, startOffsetUnit: 'px', endTarget: 'none', endOffset: 0, endOffsetUnit: 'px', size: 0, sizeUnit: 'px' })
let previousFocus: HTMLElement | null = null

const otherWindows = computed(() => props.windows.filter((window) => window.instanceId !== props.window.instanceId))
const titleId = computed(() => `wf-window-layout-title-${props.window.instanceId}`)
const errorId = computed(() => `wf-window-layout-error-${props.window.instanceId}`)
const pickerLabel = computed(() => pickerRequest.value ? `Choose a window for ${pickerRequest.value.side} anchor` : '')
const retainedRuleAvailable = computed(() => Boolean(props.window.layoutSpec && props.window.layoutSpecState === 'dormant'))

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
function formatCalculatedSize(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}
function axisEdge(axis: WindowLayoutAxis, side: 'start' | 'end'): 'left' | 'right' | 'top' | 'bottom' {
  if (axis === 'horizontal') return side === 'start' ? 'left' : 'right'
  return side === 'start' ? 'top' : 'bottom'
}
function applyAxis(draft: AxisDraft, axisSpec: WindowLayoutAxisSpec | undefined, fallbackPosition: number, fallbackSize: number): void {
  const startLength = readLength(axisSpec?.start?.offset, fallbackPosition), endLength = readLength(axisSpec?.end?.offset, 0), sizeLength = axisSpec?.size === 'auto' || axisSpec?.size === undefined ? { value: fallbackSize, unit: 'px' as const } : readLength(axisSpec.size, fallbackSize)
  draft.mode = axisSpec ? deriveWindowLayoutAxisMode(axisSpec) : 'start-size'
  draft.startTarget = readTarget(axisSpec?.start); draft.startOffset = startLength.value; draft.startOffsetUnit = startLength.unit; draft.endTarget = readTarget(axisSpec?.end); draft.endOffset = endLength.value; draft.endOffsetUnit = endLength.unit; draft.size = sizeLength.value; draft.sizeUnit = sizeLength.unit
}
function initialize(): void {
  const geometry = props.window.geometry
  mode.value = props.window.layoutSpec ? 'responsive' : 'absolute'; errorMessage.value = ''; noticeMessage.value = ''; retainedChoice.value = retainedRuleAvailable.value ? 'retained' : null; previewGeometry.value = null; previewError.value = ''; pickerRequest.value = null
  absolute.x = geometry.position.x; absolute.y = geometry.position.y; absolute.width = geometry.size.width; absolute.height = geometry.size.height; absolute.xUnit = 'px'; absolute.yUnit = 'px'; absolute.widthUnit = 'px'; absolute.heightUnit = 'px'
  applyAxis(horizontal, props.window.layoutSpec?.horizontal, geometry.position.x, geometry.size.width); applyAxis(vertical, props.window.layoutSpec?.vertical, geometry.position.y, geometry.size.height)
  if (!props.window.layoutSpec) { horizontal.mode = 'start-size'; horizontal.startTarget = 'workspace:left'; horizontal.endTarget = 'none'; vertical.mode = 'start-size'; vertical.startTarget = 'workspace:top'; vertical.endTarget = 'none' }
  const migratedAxes = (['horizontal', 'vertical'] as const).filter((axis) => {
    const spec = props.window.layoutSpec?.[axis]
    return Boolean(spec?.start && spec.end && spec.size !== undefined && spec.size !== 'auto')
  })
  if (migratedAxes.length) noticeMessage.value = `${migratedAxes.map((axis) => axis === 'horizontal' ? 'Horizontal' : 'Vertical').join(' and ')} used conflicting anchors in the saved layout. The editor will keep the start anchor and size.`
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
function draftFor(axis: WindowLayoutAxis): AxisDraft { return axis === 'horizontal' ? horizontal : vertical }
function axisGeometry(axis: WindowLayoutAxis): { position: number; size: number; available: number } {
  return axis === 'horizontal'
    ? { position: props.window.geometry.position.x, size: props.window.geometry.size.width, available: props.container.width }
    : { position: props.window.geometry.position.y, size: props.window.geometry.size.height, available: props.container.height }
}
function roundedInputValue(value: number): number { return Math.round(value * 1000) / 1000 }
function unitFromEvent(event: Event): 'px' | 'percent' {
  const value = (event.target as HTMLSelectElement | null)?.value
  if (value !== 'px' && value !== 'percent') throw new Error('Unsupported layout unit')
  return value
}
function setAbsoluteUnit(field: 'x' | 'y' | 'width' | 'height', event: Event): void {
  try {
    const nextUnit = unitFromEvent(event)
    const unitField = `${field}Unit` as 'xUnit' | 'yUnit' | 'widthUnit' | 'heightUnit'
    const available = field === 'x' || field === 'width' ? props.container.width : props.container.height
    const converted = convertWindowLayoutValue(numeric(absolute[field], field), absolute[unitField], nextUnit, available)
    absolute[field] = roundedInputValue(converted)
    absolute[unitField] = nextUnit
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not convert layout unit.'
  }
}
function setAxisUnit(axis: WindowLayoutAxis, field: 'startOffset' | 'endOffset' | 'size', event: Event): void {
  try {
    const nextUnit = unitFromEvent(event)
    const draft = draftFor(axis)
    const unitField = `${field}Unit` as 'startOffsetUnit' | 'endOffsetUnit' | 'sizeUnit'
    const converted = convertWindowLayoutValue(numeric(draft[field], `${axis} ${field}`), draft[unitField], nextUnit, axisGeometry(axis).available)
    draft[field] = roundedInputValue(converted)
    draft[unitField] = nextUnit
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not convert layout unit.'
  }
}
function setAbsoluteFromGeometry(geometry: WindowGeometry): void {
  absolute.x = geometry.position.x; absolute.y = geometry.position.y; absolute.width = geometry.size.width; absolute.height = geometry.size.height
  absolute.xUnit = 'px'; absolute.yUnit = 'px'; absolute.widthUnit = 'px'; absolute.heightUnit = 'px'
}
function setResponsiveFromGeometry(geometry: WindowGeometry): void {
  applyAxis(horizontal, undefined, geometry.position.x, geometry.size.width); applyAxis(vertical, undefined, geometry.position.y, geometry.size.height)
  horizontal.startTarget = 'workspace:left'; horizontal.endTarget = 'none'; vertical.startTarget = 'workspace:top'; vertical.endTarget = 'none'
  retainedChoice.value = 'current'
}
function useRetainedRule(): void {
  if (!props.window.layoutSpec) return
  applyAxis(horizontal, props.window.layoutSpec.horizontal, props.window.geometry.position.x, props.window.geometry.size.width)
  applyAxis(vertical, props.window.layoutSpec.vertical, props.window.geometry.position.y, props.window.geometry.size.height)
  retainedChoice.value = 'retained'
  errorMessage.value = ''
}
function startFromCurrentGeometry(): void {
  setResponsiveFromGeometry(props.window.geometry)
  noticeMessage.value = 'Starting from current geometry. The retained responsive rule will be replaced when you save.'
  errorMessage.value = ''
}
function setLayoutMode(nextMode: LayoutMode): void {
  if (mode.value === nextMode) return
  if (nextMode === 'responsive') {
    try {
      if (retainedRuleAvailable.value && retainedChoice.value === 'retained') useRetainedRule()
      else setResponsiveFromGeometry(mode.value === 'absolute' ? absoluteGeometry() : props.window.geometry)
    } catch {
      setResponsiveFromGeometry(props.window.geometry)
    }
  } else {
    setAbsoluteFromGeometry(props.window.geometry)
  }
  mode.value = nextMode
}
function workspaceTarget(axis: WindowLayoutAxis, side: 'start' | 'end'): TargetValue { return `workspace:${axisEdge(axis, side)}` }
function setAxisMode(axis: WindowLayoutAxis, nextMode: WindowLayoutAxisMode): void {
  const draft = draftFor(axis)
  if (draft.mode === nextMode) return
  const geometry = axisGeometry(axis)
  if (nextMode === 'stretch') {
    if (draft.startTarget === 'none') { draft.startTarget = workspaceTarget(axis, 'start'); draft.startOffset = geometry.position; draft.startOffsetUnit = 'px' }
    if (draft.endTarget === 'none') { draft.endTarget = workspaceTarget(axis, 'end'); draft.endOffset = geometry.position + geometry.size - geometry.available; draft.endOffsetUnit = 'px' }
  } else {
    draft.size = geometry.size
    draft.sizeUnit = 'px'
    if (nextMode === 'start-size' && draft.startTarget === 'none') { draft.startTarget = workspaceTarget(axis, 'start'); draft.startOffset = geometry.position; draft.startOffsetUnit = 'px' }
    if (nextMode === 'end-size' && draft.endTarget === 'none') { draft.endTarget = workspaceTarget(axis, 'end'); draft.endOffset = geometry.position + geometry.size - geometry.available; draft.endOffsetUnit = 'px' }
  }
  draft.mode = nextMode
  errorMessage.value = ''
}
function writeAxis(draft: AxisDraft, axis: WindowLayoutAxis, label: string): WindowLayoutAxisSpec {
  const startOffset = length(draft.startOffset, draft.startOffsetUnit, `${label} start offset`), endOffset = length(draft.endOffset, draft.endOffsetUnit, `${label} end offset`)
  const start = draft.mode === 'end-size' ? undefined : parseTarget(draft.startTarget, axis, startOffset)
  const end = draft.mode === 'start-size' ? undefined : parseTarget(draft.endTarget, axis, endOffset)
  const size = draft.mode === 'stretch' ? 'auto' as const : length(draft.size, draft.sizeUnit, `${label} size`)
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
function previewDraft(): void {
  if (!props.open) return
  try {
    if (mode.value === 'absolute') {
      const geometry = absoluteGeometry()
      previewGeometry.value = geometry
      previewError.value = ''
      emit('preview', { sourceInstanceId: props.window.instanceId, layoutSpec: null, geometry })
      return
    }
    const layoutSpec = responsiveSpec()
    const geometry = resolveWindowLayoutSpecs(props.windows.map((window) => window.instanceId === props.window.instanceId ? { ...window, layoutSpec } : window), props.container).get(props.window.instanceId)
    if (!geometry) throw new Error('Window geometry could not be resolved')
    previewGeometry.value = geometry
    previewError.value = ''
    emit('preview', { sourceInstanceId: props.window.instanceId, layoutSpec, geometry })
  } catch (error) {
    previewGeometry.value = null
    previewError.value = error instanceof Error ? 'Preview unavailable until the layout is valid.' : 'Preview unavailable.'
    emit('preview', null)
  }
}
function save(): void {
  try {
    if (!previewGeometry.value) throw new Error('Preview is not valid')
    emit('preview', null)
    if (mode.value === 'absolute') emit('save', { layoutSpec: null, geometry: absoluteGeometry() })
    else { const spec = responsiveSpec(), geometry = resolveWindowLayoutSpecs(props.windows.map((window) => window.instanceId === props.window.instanceId ? { ...window, layoutSpec: spec } : window), props.container).get(props.window.instanceId); if (!geometry) throw new Error('Window geometry could not be resolved'); emit('save', { layoutSpec: spec, geometry }) }
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'Invalid layout'
    errorMessage.value = /cycle/i.test(raw) ? 'This relationship would create a cycle.' : /unknown|no longer available|missing/i.test(raw) ? 'Choose an existing target window and anchor.' : /contradictory/i.test(raw) ? 'The right/bottom anchor must be after the left/top anchor.' : raw
  }
}
function clearPickerMarkers(): void { for (const element of document.querySelectorAll<HTMLElement>('[data-layout-picker-source], [data-layout-picker-target]')) { delete element.dataset.layoutPickerSource; delete element.dataset.layoutPickerTarget } }
function markPickerSource(): void { clearPickerMarkers(); const source = [...document.querySelectorAll<HTMLElement>('[data-window-instance-id]')].find((element) => element.dataset.windowInstanceId === props.window.instanceId); if (source) source.dataset.layoutPickerSource = 'true' }
function cancel(): void { pickerRequest.value = null; clearPickerMarkers(); previewGeometry.value = null; emit('preview', null); emit('cancel') }
function handleBackdrop(event: MouseEvent): void { if (event.target === event.currentTarget && !pickerRequest.value) cancel() }
function handleKeydown(event: KeyboardEvent): void { if (event.key === 'Escape') { event.preventDefault(); if (pickerRequest.value) { pickerRequest.value = null; clearPickerMarkers() } else cancel(); return } if (event.key === 'Tab' && dialog.value) { event.preventDefault(); trapFocus(dialog.value, event.shiftKey) } }
function startPicker(axis: PickerAxis, side: PickerSide): void { pickerRequest.value = { axis, side }; errorMessage.value = ''; markPickerSource() }
function setTargetValue(axis: PickerAxis, side: PickerSide, value: TargetValue): void { const draft = draftFor(axis); if (side === 'left' || side === 'top') draft.startTarget = value; else draft.endTarget = value }
function onDocumentPointerDown(event: PointerEvent): void {
  const request = pickerRequest.value; if (!request) return
  const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-window-instance-id]') : null, instanceId = element?.dataset.windowInstanceId
  if (!instanceId || instanceId === props.window.instanceId || !otherWindows.value.some((window) => window.instanceId === instanceId)) return
  const edge = request.side === 'left' ? 'right' : request.side === 'right' ? 'left' : request.side === 'top' ? 'bottom' : 'top'
  setTargetValue(request.axis, request.side, `window:${instanceId}:${edge}`); clearPickerMarkers(); element.dataset.layoutPickerTarget = 'true'; pickerRequest.value = null; event.preventDefault()
}
watch(() => props.open, async (open) => { if (open) { previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null; initialize(); previewDraft(); await nextTick(); if (dialog.value) focusModal(dialog.value) } else { previewGeometry.value = null; emit('preview', null); const restore = previousFocus; previousFocus = null; await nextTick(); restore?.focus() } }, { immediate: true })
watch(() => props.window.instanceId, () => { if (props.open) initialize() })
watch([mode, absolute, horizontal, vertical, retainedChoice], () => { previewDraft() }, { deep: true, flush: 'post' })
onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown, true))
onBeforeUnmount(() => { document.removeEventListener('pointerdown', onDocumentPointerDown, true); clearPickerMarkers(); previewGeometry.value = null; emit('preview', null); const restore = previousFocus; previousFocus = null; restore?.focus() })
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
        <p v-if="previewGeometry" class="wf-window-layout-dialog__preview" data-layout-preview>Preview: X {{ Math.round(previewGeometry.position.x) }} · Y {{ Math.round(previewGeometry.position.y) }} · {{ Math.round(previewGeometry.size.width) }} × {{ Math.round(previewGeometry.size.height) }} px</p>
        <p v-else-if="previewError" class="wf-window-layout-dialog__preview-error" data-layout-preview-error role="status">{{ previewError }}</p>
        <fieldset><legend>Layout type</legend><label><input type="radio" :checked="mode === 'absolute'" value="absolute" @change="setLayoutMode('absolute')" /> Free geometry</label><label><input type="radio" :checked="mode === 'responsive'" value="responsive" @change="setLayoutMode('responsive')" /> Anchored / responsive layout</label></fieldset>
        <div v-if="mode === 'absolute'" class="wf-window-layout-dialog__grid">
          <label>X <input v-model="absolute.x" type="number" step="any" inputmode="decimal" data-layout-x /><select :value="absolute.xUnit" aria-label="X unit" @change="setAbsoluteUnit('x', $event)"><option value="px">px</option><option value="percent">%</option></select></label>
          <label>Y <input v-model="absolute.y" type="number" step="any" inputmode="decimal" data-layout-y /><select :value="absolute.yUnit" aria-label="Y unit" @change="setAbsoluteUnit('y', $event)"><option value="px">px</option><option value="percent">%</option></select></label>
          <label>Width <input v-model="absolute.width" type="number" step="any" min="0" inputmode="decimal" data-layout-width /><select :value="absolute.widthUnit" aria-label="Width unit" @change="setAbsoluteUnit('width', $event)"><option value="px">px</option><option value="percent">%</option></select></label>
          <label>Height <input v-model="absolute.height" type="number" step="any" min="0" inputmode="decimal" data-layout-height /><select :value="absolute.heightUnit" aria-label="Height unit" @change="setAbsoluteUnit('height', $event)"><option value="px">px</option><option value="percent">%</option></select></label>
        </div>
        <template v-else>
          <div v-if="retainedRuleAvailable" class="wf-window-layout-dialog__retained" data-layout-retained-choice>
            <strong>Responsive rule retained</strong>
            <span v-if="retainedChoice === 'retained'">Continue editing the saved responsive rule or start from the current free geometry.</span>
            <span v-else>Starting from the current geometry; the retained rule will not be reused.</span>
            <div class="wf-window-layout-dialog__retained-actions"><button type="button" :disabled="retainedChoice === 'retained'" data-layout-use-retained @click="useRetainedRule">Continue editing retained rule</button><button type="button" :disabled="retainedChoice === 'current'" data-layout-start-current @click="startFromCurrentGeometry">Start from current geometry</button></div>
          </div>
          <fieldset>
            <legend>Horizontal</legend>
            <div class="wf-window-layout-dialog__modes" role="radiogroup" aria-label="Horizontal sizing mode">
              <label><input type="radio" :checked="horizontal.mode === 'start-size'" data-layout-horizontal-mode="start-size" @change="setAxisMode('horizontal', 'start-size')" /> Left + Width</label>
              <label><input type="radio" :checked="horizontal.mode === 'end-size'" data-layout-horizontal-mode="end-size" @change="setAxisMode('horizontal', 'end-size')" /> Right + Width</label>
              <label><input type="radio" :checked="horizontal.mode === 'stretch'" data-layout-horizontal-mode="stretch" @change="setAxisMode('horizontal', 'stretch')" /> Stretch Left ↔ Right</label>
            </div>
            <template v-if="horizontal.mode !== 'end-size'">
              <label>Left <select v-model="horizontal.startTarget" data-layout-left-target data-layout-horizontal-start><option value="none">Not anchored</option><optgroup label="Workspace"><option v-for="target in horizontalTargets.filter((target) => target.kind === 'workspace')" :key="target.value" :value="target.value">{{ target.label }}</option></optgroup><optgroup label="Windows"><option v-for="target in horizontalTargets.filter((target) => target.kind === 'window')" :key="target.value" :value="target.value">{{ target.label }}</option></optgroup></select><button type="button" data-layout-pick="horizontal:left" @click="startPicker('horizontal', 'left')">Auf Canvas wählen</button></label>
              <label>Left offset <input v-model="horizontal.startOffset" type="number" step="any" data-layout-left-offset /><select :value="horizontal.startOffsetUnit" aria-label="Left offset unit" @change="setAxisUnit('horizontal', 'startOffset', $event)"><option value="px">px</option><option value="percent">%</option></select></label>
            </template>
            <template v-if="horizontal.mode !== 'start-size'">
              <label>Right <select v-model="horizontal.endTarget" data-layout-right-target data-layout-horizontal-end><option value="none">Not anchored</option><optgroup label="Workspace"><option v-for="target in horizontalTargets.filter((target) => target.kind === 'workspace')" :key="target.value" :value="target.value">{{ target.label }}</option></optgroup><optgroup label="Windows"><option v-for="target in horizontalTargets.filter((target) => target.kind === 'window')" :key="target.value" :value="target.value">{{ target.label }}</option></optgroup></select><button type="button" data-layout-pick="horizontal:right" @click="startPicker('horizontal', 'right')">Auf Canvas wählen</button></label>
              <label>Right offset <input v-model="horizontal.endOffset" type="number" step="any" data-layout-right-offset /><select :value="horizontal.endOffsetUnit" aria-label="Right offset unit" @change="setAxisUnit('horizontal', 'endOffset', $event)"><option value="px">px</option><option value="percent">%</option></select></label>
            </template>
            <label v-if="horizontal.mode !== 'stretch'">Width <input v-model="horizontal.size" type="number" step="any" data-layout-width /><select :value="horizontal.sizeUnit" aria-label="Width unit" @change="setAxisUnit('horizontal', 'size', $event)"><option value="px">px</option><option value="percent">%</option></select></label>
            <p v-else class="wf-window-layout-dialog__calculated" data-layout-calculated-width>Width: <output data-layout-width>{{ formatCalculatedSize(props.window.geometry.size.width) }}</output> px (calculated from both anchors)</p>
          </fieldset>
          <fieldset>
            <legend>Vertical</legend>
            <div class="wf-window-layout-dialog__modes" role="radiogroup" aria-label="Vertical sizing mode">
              <label><input type="radio" :checked="vertical.mode === 'start-size'" data-layout-vertical-mode="start-size" @change="setAxisMode('vertical', 'start-size')" /> Top + Height</label>
              <label><input type="radio" :checked="vertical.mode === 'end-size'" data-layout-vertical-mode="end-size" @change="setAxisMode('vertical', 'end-size')" /> Bottom + Height</label>
              <label><input type="radio" :checked="vertical.mode === 'stretch'" data-layout-vertical-mode="stretch" @change="setAxisMode('vertical', 'stretch')" /> Stretch Top ↔ Bottom</label>
            </div>
            <template v-if="vertical.mode !== 'end-size'">
              <label>Top <select v-model="vertical.startTarget" data-layout-top-target data-layout-vertical-start><option value="none">Not anchored</option><optgroup label="Workspace"><option v-for="target in verticalTargets.filter((target) => target.kind === 'workspace')" :key="target.value" :value="target.value">{{ target.label }}</option></optgroup><optgroup label="Windows"><option v-for="target in verticalTargets.filter((target) => target.kind === 'window')" :key="target.value" :value="target.value">{{ target.label }}</option></optgroup></select><button type="button" data-layout-pick="vertical:top" @click="startPicker('vertical', 'top')">Auf Canvas wählen</button></label>
              <label>Top offset <input v-model="vertical.startOffset" type="number" step="any" data-layout-top-offset /><select :value="vertical.startOffsetUnit" aria-label="Top offset unit" @change="setAxisUnit('vertical', 'startOffset', $event)"><option value="px">px</option><option value="percent">%</option></select></label>
            </template>
            <template v-if="vertical.mode !== 'start-size'">
              <label>Bottom <select v-model="vertical.endTarget" data-layout-bottom-target data-layout-vertical-end><option value="none">Not anchored</option><optgroup label="Workspace"><option v-for="target in verticalTargets.filter((target) => target.kind === 'workspace')" :key="target.value" :value="target.value">{{ target.label }}</option></optgroup><optgroup label="Windows"><option v-for="target in verticalTargets.filter((target) => target.kind === 'window')" :key="target.value" :value="target.value">{{ target.label }}</option></optgroup></select><button type="button" data-layout-pick="vertical:bottom" @click="startPicker('vertical', 'bottom')">Auf Canvas wählen</button></label>
              <label>Bottom offset <input v-model="vertical.endOffset" type="number" step="any" data-layout-bottom-offset /><select :value="vertical.endOffsetUnit" aria-label="Bottom offset unit" @change="setAxisUnit('vertical', 'endOffset', $event)"><option value="px">px</option><option value="percent">%</option></select></label>
            </template>
            <label v-if="vertical.mode !== 'stretch'">Height <input v-model="vertical.size" type="number" step="any" data-layout-height /><select :value="vertical.sizeUnit" aria-label="Height unit" @change="setAxisUnit('vertical', 'size', $event)"><option value="px">px</option><option value="percent">%</option></select></label>
            <p v-else class="wf-window-layout-dialog__calculated" data-layout-calculated-height>Height: <output data-layout-height>{{ formatCalculatedSize(props.window.geometry.size.height) }}</output> px (calculated from both anchors)</p>
          </fieldset>
          <p class="wf-window-layout-dialog__summary" data-layout-relationship-summary>Horizontal: {{ horizontal.mode }} · Vertical: {{ vertical.mode }} · Left {{ horizontal.startTarget === 'none' ? 'free' : horizontal.startTarget }} · Right {{ horizontal.endTarget === 'none' ? 'free' : horizontal.endTarget }} · Top {{ vertical.startTarget === 'none' ? 'free' : vertical.startTarget }} · Bottom {{ vertical.endTarget === 'none' ? 'free' : vertical.endTarget }}</p>
          <p v-if="pickerRequest" class="wf-window-layout-dialog__picker" data-layout-picker-state role="status">{{ pickerLabel }} — click a highlighted window in the workspace. Press Escape to cancel.</p>
        </template>
        <p v-if="noticeMessage" class="wf-window-layout-dialog__notice" role="status">{{ noticeMessage }}</p>
        <p v-if="errorMessage" :id="errorId" class="wf-window-layout-dialog__error" role="alert">{{ errorMessage }}</p>
        <footer class="wf-window-layout-dialog__actions"><button type="button" @click="cancel">Cancel</button><button type="submit" data-layout-save :disabled="!previewGeometry">Save layout</button></footer>
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
.wf-window-layout-dialog__header small, .wf-window-layout-dialog__resolved, .wf-window-layout-dialog__preview, .wf-window-layout-dialog__preview-error { color: var(--wf-color-text-muted); font-size: var(--wf-font-size-sm); }
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
.wf-window-layout-dialog__modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--wf-space-xs); }
.wf-window-layout-dialog__modes label { display: flex; min-height: var(--wf-size-control-height-compact); padding: var(--wf-space-xs) var(--wf-space-sm); border: 1px solid var(--wf-color-border); border-radius: var(--wf-radius-sm); background: var(--wf-color-surface); }
.wf-window-layout-dialog__modes input { min-height: auto; }
.wf-window-layout-dialog__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--wf-space-md); }
.wf-window-layout-dialog__grid label { grid-template-columns: auto minmax(0, 1fr) auto; }
.wf-window-layout-dialog__hint, .wf-window-layout-dialog__summary, .wf-window-layout-dialog__picker, .wf-window-layout-dialog__calculated, .wf-window-layout-dialog__notice { margin: 0; color: var(--wf-color-text-muted); font-size: var(--wf-font-size-sm); }
.wf-window-layout-dialog__notice { padding: var(--wf-space-sm); border-left: 3px solid var(--wf-color-accent); }
.wf-window-layout-dialog__preview { margin: 0; padding: var(--wf-space-sm); border-left: 3px solid var(--wf-color-success); color: var(--wf-color-success); }
.wf-window-layout-dialog__preview-error { margin: 0; padding: var(--wf-space-sm); border-left: 3px solid var(--wf-color-warning); color: var(--wf-color-warning); }
.wf-window-layout-dialog__retained { display: grid; gap: var(--wf-space-xs); padding: var(--wf-space-sm); border: 1px solid var(--wf-color-border); border-radius: var(--wf-radius-sm); background: var(--wf-color-surface); font-size: var(--wf-font-size-sm); }
.wf-window-layout-dialog__retained > span { color: var(--wf-color-text-muted); }
.wf-window-layout-dialog__retained-actions { display: flex; flex-wrap: wrap; gap: var(--wf-space-sm); }
.wf-window-layout-dialog__retained-actions button { padding: 0 var(--wf-space-sm); }
.wf-window-layout-dialog__picker { padding: var(--wf-space-sm); border-left: 3px solid var(--wf-color-focus); color: var(--wf-color-accent); }
.wf-window-layout-dialog__error { margin: 0; padding: var(--wf-space-sm); border-left: 3px solid var(--wf-color-danger); color: var(--wf-color-danger); }
.wf-window-layout-dialog__actions { display: flex; justify-content: flex-end; gap: var(--wf-space-sm); }
.wf-window-layout-dialog__actions button { padding: 0 var(--wf-space-md); }
.wf-window-layout-dialog__actions button:last-child { border-color: var(--wf-color-accent); color: var(--wf-color-accent); }
.wf-window-layout-dialog button:focus-visible, .wf-window-layout-dialog input:focus-visible, .wf-window-layout-dialog select:focus-visible { outline: 2px solid var(--wf-color-focus); outline-offset: 2px; }
@media (max-width: 720px) { .wf-window-layout-dialog__grid, .wf-window-layout-dialog__modes { grid-template-columns: 1fr; } .wf-window-layout-dialog label { grid-template-columns: 1fr; } }
</style>
