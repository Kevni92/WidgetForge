<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { normalizeWindowGeometry, type WindowGeometry, type WindowSize } from '../core/window-geometry'
import { cloneWindowLayoutSpec, convertWindowLayoutValue, deriveWindowLayoutAxisMode, removeWindowLayoutConstraint, resolveWindowLayoutSpecs, setWindowLayoutConstraint, type WindowLayoutAnchor, type WindowLayoutAxis, type WindowLayoutAxisMode, type WindowLayoutEdge, type WindowLayoutSpec } from '../core/window-layout'
import type { WindowState } from '../core/window-manager'
import type { WindowLayoutDialogPreview, WindowLayoutDialogSave } from './WindowLayoutDialog.vue'

interface Props {
  readonly window: WindowState | null
  readonly windows: readonly WindowState[]
  readonly container: WindowSize
  readonly surface?: string | undefined
  readonly rule?: string | undefined
  readonly selectedConstraintEdge?: WindowLayoutEdge | null | undefined
  readonly mode?: InspectorMode | undefined
  readonly floatingPosition?: InspectorFloatingPosition | undefined
}

const props = defineProps<Props>()
const emit = defineEmits<{
  lock: [instanceId: string]
  unlock: [instanceId: string]
  layout: [instanceId: string]
  preview: [value: WindowLayoutDialogPreview | null]
  save: [value: WindowLayoutDialogSave]
  editStart: []
  cancel: []
  constraintSelect: [edge: WindowLayoutEdge]
  modeChange: [mode: InspectorMode]
  floatingPositionChange: [position: InspectorFloatingPosition]
}>()

type InspectorMode = 'docked' | 'floating' | 'minimized'
type InspectorExpandedMode = Exclude<InspectorMode, 'minimized'>
interface InspectorFloatingPosition { readonly x: number; readonly y: number }
type DraftUnit = 'px' | 'percent'
type DraftValue = { value: string; unit: DraftUnit }
type DraftField = 'x' | 'y' | 'width' | 'height'
const horizontalEdges: readonly WindowLayoutEdge[] = ['left', 'right']
const verticalEdges: readonly WindowLayoutEdge[] = ['top', 'bottom']
const allEdges: readonly WindowLayoutEdge[] = ['top', 'right', 'bottom', 'left']
const root = ref<HTMLElement | null>(null)
const draftSpec = ref<WindowLayoutSpec | null>(null)
const draftGeometry = ref<WindowGeometry | null>(null)
const editing = ref(false)
const errorMessage = ref('')
const inspectorMode = ref<InspectorMode>(props.mode ?? 'docked')
const lastExpandedMode = ref<InspectorExpandedMode>(inspectorMode.value === 'floating' ? 'floating' : 'docked')
const floatingPosition = ref<InspectorFloatingPosition>({ x: props.floatingPosition?.x ?? 16, y: props.floatingPosition?.y ?? 56 })
const header = ref<HTMLElement | null>(null)
const restoreControl = ref<HTMLButtonElement | null>(null)
interface DragSession {
  readonly pointerId: number | undefined
  readonly startX: number
  readonly startY: number
  readonly startPosition: InspectorFloatingPosition
}
let dragSession: DragSession | null = null
let disposeDrag: (() => void) | null = null
const constraintDrafts = reactive<Record<WindowLayoutEdge, DraftValue>>({
  top: { value: '0', unit: 'px' },
  right: { value: '0', unit: 'px' },
  bottom: { value: '0', unit: 'px' },
  left: { value: '0', unit: 'px' },
})
const freeDraft = reactive<Record<DraftField, string>>({ x: '0', y: '0', width: '0', height: '0' })

const currentWindow = computed(() => props.window)
const inspectorStyle = computed<Record<string, string>>(() => {
  if (inspectorMode.value === 'floating' || (inspectorMode.value === 'minimized' && lastExpandedMode.value === 'floating')) {
    return { left: `${floatingPosition.value.x}px`, top: `${floatingPosition.value.y}px`, right: 'auto', bottom: 'auto' }
  }
  return {}
})
const activeSpec = computed(() => draftSpec.value ?? currentWindow.value?.layoutSpec ?? null)
const isResponsive = computed(() => activeSpec.value !== null)
const surfaceLabel = computed(() => ({ floating: 'Floating', snapped: 'Snapped', locked: 'Locked layout' }[props.surface ?? (currentWindow.value?.layoutLocked ? 'locked' : currentWindow.value?.snap ? 'snapped' : 'floating')] ?? 'Floating'))
const ruleLabel = computed(() => ({ none: 'No responsive rule', active: 'Responsive active', dormant: 'Responsive dormant', materialized: 'Free geometry / materialized' }[props.rule ?? (currentWindow.value?.layoutSpecState ?? (currentWindow.value?.layoutSpec ? 'dormant' : 'none'))] ?? 'No responsive rule'))

function cloneGeometry(geometry: WindowGeometry): WindowGeometry {
  return { position: { ...geometry.position }, size: { ...geometry.size } }
}
function effectiveContainer(): WindowSize {
  const window = currentWindow.value
  if (props.container.width > 0 && props.container.height > 0) return props.container
  return { width: Math.max(1, (window?.geometry.position.x ?? 0) + (window?.geometry.size.width ?? 1)), height: Math.max(1, (window?.geometry.position.y ?? 0) + (window?.geometry.size.height ?? 1)) }
}
function geometryForDraft(): WindowGeometry {
  return draftGeometry.value ?? currentWindow.value?.geometry ?? { position: { x: 0, y: 0 }, size: { width: 1, height: 1 } }
}
function axisSpec(axis: WindowLayoutAxis): WindowLayoutSpec['horizontal'] {
  const spec = activeSpec.value
  return spec ? (axis === 'horizontal' ? spec.horizontal : spec.vertical) : {}
}
function edgeAxis(edge: WindowLayoutEdge): WindowLayoutAxis { return edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical' }
function edgeSide(edge: WindowLayoutEdge): 'start' | 'end' { return edge === 'left' || edge === 'top' ? 'start' : 'end' }
function anchorFor(edge: WindowLayoutEdge): WindowLayoutAnchor | undefined {
  const axis = axisSpec(edgeAxis(edge))
  return edgeSide(edge) === 'start' ? axis.start : axis.end
}
function modeFor(axis: WindowLayoutAxis): WindowLayoutAxisMode | 'free' {
  const spec = activeSpec.value
  return spec ? deriveWindowLayoutAxisMode(axis === 'horizontal' ? spec.horizontal : spec.vertical) : 'free'
}
function availableFor(axis: WindowLayoutAxis): number { return axis === 'horizontal' ? effectiveContainer().width : effectiveContainer().height }
function geometryEdge(geometry: WindowGeometry, edge: WindowLayoutEdge): number {
  if (edge === 'left') return geometry.position.x
  if (edge === 'right') return geometry.position.x + geometry.size.width
  if (edge === 'top') return geometry.position.y
  return geometry.position.y + geometry.size.height
}
function targetBase(anchor: WindowLayoutAnchor): number {
  const axis = edgeAxis(anchor.target.edge)
  if (anchor.target.kind === 'workspace') {
    return anchor.target.edge === 'left' || anchor.target.edge === 'top' ? 0 : availableFor(axis)
  }
  const targetId = anchor.target.instanceId
  const target = props.windows.find((window) => window.instanceId === targetId)
  return target ? geometryEdge(target.geometry, anchor.target.edge) : 0
}
function targetLabel(anchor: WindowLayoutAnchor): string {
  if (anchor.target.kind === 'workspace') return `Workspace · ${anchor.target.edge}`
  const targetId = anchor.target.instanceId
  const target = props.windows.find((window) => window.instanceId === targetId)
  return target ? `${target.title} · ${target.instanceId} · ${anchor.target.edge}` : `${targetId} · ${anchor.target.edge}`
}
function isOpposite(source: WindowLayoutEdge, target: WindowLayoutEdge): boolean {
  return (source === 'left' && target === 'right') || (source === 'right' && target === 'left') || (source === 'top' && target === 'bottom') || (source === 'bottom' && target === 'top')
}
function physicalGap(edge: WindowLayoutEdge, anchor: WindowLayoutAnchor, geometry = geometryForDraft()): number {
  const raw = geometryEdge(geometry, edge) - targetBase(anchor)
  return isOpposite(edge, anchor.target.edge) && (edge === 'right' || edge === 'bottom') ? -raw : raw
}
function displayValue(edge: WindowLayoutEdge): number {
  const anchor = anchorFor(edge)
  const unit = constraintDrafts[edge].unit
  if (!anchor) return 0
  return convertWindowLayoutValue(physicalGap(edge, anchor), 'px', unit, availableFor(edgeAxis(edge)))
}
function rounded(value: number): string { return String(Math.round(value * 1000) / 1000) }
function targetValue(anchor: WindowLayoutAnchor): string { return anchor.target.kind === 'workspace' ? 'workspace' : `window:${anchor.target.instanceId}` }
function targetOptions(edge: WindowLayoutEdge): readonly { value: string; label: string }[] {
  const axis = edgeAxis(edge)
  const edges = axis === 'horizontal' ? horizontalEdges : verticalEdges
  return [
    ...edges.map((targetEdge) => ({ value: `workspace:${targetEdge}`, label: `Workspace · ${targetEdge}` })),
    ...props.windows.filter((window) => window.instanceId !== currentWindow.value?.instanceId).flatMap((window) => edges.map((targetEdge) => ({ value: `window:${window.instanceId}:${targetEdge}`, label: `${window.title} · ${window.instanceId} · ${targetEdge}` }))),
  ]
}
function targetEdgeValue(edge: WindowLayoutEdge): WindowLayoutEdge {
  return anchorFor(edge)?.target.edge ?? edge
}
function targetHostValue(edge: WindowLayoutEdge): string {
  const anchor = anchorFor(edge)
  return anchor?.target.kind === 'window' ? `window:${anchor.target.instanceId}` : 'workspace'
}
function axisSize(axis: WindowLayoutAxis): number {
  const geometry = geometryForDraft()
  return axis === 'horizontal' ? geometry.size.width : geometry.size.height
}
function axisSizeUnit(axis: WindowLayoutAxis): DraftUnit {
  const size = axisSpec(axis).size
  return size && size !== 'auto' ? size.unit : 'px'
}
function axisSizeValue(axis: WindowLayoutAxis): string {
  const size = axisSpec(axis).size
  if (!size || size === 'auto') return rounded(axisSize(axis))
  return String(size.value)
}
function syncDraftFields(): void {
  const window = currentWindow.value
  if (!window) return
  const geometry = geometryForDraft()
  freeDraft.x = rounded(geometry.position.x); freeDraft.y = rounded(geometry.position.y); freeDraft.width = rounded(geometry.size.width); freeDraft.height = rounded(geometry.size.height)
  for (const edge of allEdges) {
    const anchor = anchorFor(edge)
    const unit = anchor?.offset?.unit ?? 'px'
    constraintDrafts[edge].unit = unit
    constraintDrafts[edge].value = rounded(displayValue(edge))
  }
}
function startEdit(): void {
  if (!currentWindow.value || editing.value) return
  editing.value = true
  draftSpec.value = currentWindow.value.layoutSpec ? cloneWindowLayoutSpec(currentWindow.value.layoutSpec) : null
  draftGeometry.value = cloneGeometry(currentWindow.value.geometry)
  errorMessage.value = ''
  syncDraftFields()
  emit('editStart')
}
function setSpecAxis(spec: WindowLayoutSpec, axis: WindowLayoutAxis, next: WindowLayoutSpec['horizontal']): WindowLayoutSpec {
  return axis === 'horizontal' ? { horizontal: next, vertical: spec.vertical } : { horizontal: spec.horizontal, vertical: next }
}
function draftContainerWindows(spec: WindowLayoutSpec): readonly WindowState[] {
  const window = currentWindow.value
  return props.windows.map((candidate) => candidate.instanceId === window?.instanceId ? { ...candidate, layoutSpec: spec } : candidate)
}
function previewDraft(): void {
  const window = currentWindow.value
  if (!window || !editing.value) return
  try {
    const container = effectiveContainer()
    if (draftSpec.value) {
      const geometry = resolveWindowLayoutSpecs(draftContainerWindows(draftSpec.value), container).get(window.instanceId)
      if (!geometry) throw new Error('Window geometry could not be resolved')
      draftGeometry.value = geometry
      errorMessage.value = ''
      emit('preview', { sourceInstanceId: window.instanceId, layoutSpec: draftSpec.value, geometry })
    } else {
      const geometry = normalizeWindowGeometry(draftGeometry.value ?? window.geometry, window.constraints, container)
      draftGeometry.value = geometry
      errorMessage.value = ''
      emit('preview', { sourceInstanceId: window.instanceId, layoutSpec: null, geometry })
    }
  } catch (error) {
    errorMessage.value = error instanceof Error && /cycle/i.test(error.message) ? 'This relationship would create a cycle.' : 'The layout draft is not valid.'
    emit('preview', null)
  }
}
function parseNumber(value: string, label: string): number {
  if (value.trim() === '') throw new Error(`${label} must be a number`)
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error(`${label} must be finite`)
  return number
}
function updateFree(field: DraftField, event: Event): void {
  startEdit()
  const value = (event.target as HTMLInputElement).value
  freeDraft[field] = value
  try {
    const window = currentWindow.value
    if (!window) return
    const geometry = geometryForDraft()
    const next = { ...geometry, position: { ...geometry.position }, size: { ...geometry.size } }
    if (field === 'x') next.position.x = parseNumber(value, 'X')
    if (field === 'y') next.position.y = parseNumber(value, 'Y')
    if (field === 'width') next.size.width = parseNumber(value, 'Width')
    if (field === 'height') next.size.height = parseNumber(value, 'Height')
    draftGeometry.value = next
    previewDraft()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Invalid value'; emit('preview', null) }
}
function updateSize(axis: WindowLayoutAxis, event: Event): void {
  startEdit()
  try {
    const value = parseNumber((event.target as HTMLInputElement).value, axis === 'horizontal' ? 'Width' : 'Height')
    const spec = activeSpec.value
    if (!spec || axisSpec(axis).size === undefined || axisSpec(axis).size === 'auto') return
    const nextAxis = { ...axisSpec(axis), size: { value, unit: axisSizeUnit(axis) } }
    draftSpec.value = setSpecAxis(spec, axis, nextAxis)
    previewDraft()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Invalid size'; emit('preview', null) }
}
function updateSizeUnit(axis: WindowLayoutAxis, event: Event): void {
  startEdit()
  const nextUnit = (event.target as HTMLSelectElement).value as DraftUnit
  const size = axisSpec(axis).size
  if (!activeSpec.value || !size || size === 'auto') return
  const nextValue = convertWindowLayoutValue(axisSize(axis), 'px', nextUnit, availableFor(axis))
  draftSpec.value = setSpecAxis(activeSpec.value, axis, { ...axisSpec(axis), size: { value: nextValue, unit: nextUnit } })
  previewDraft()
}
function updateDistanceUnit(edge: WindowLayoutEdge, event: Event): void {
  startEdit()
  const anchor = anchorFor(edge)
  if (!anchor || !activeSpec.value) return
  const nextUnit = (event.target as HTMLSelectElement).value as DraftUnit
  const gap = physicalGap(edge, anchor)
  constraintDrafts[edge].unit = nextUnit
  constraintDrafts[edge].value = rounded(convertWindowLayoutValue(gap, 'px', nextUnit, availableFor(edgeAxis(edge))))
  const rawPixels = geometryEdge(geometryForDraft(), edge) - targetBase(anchor)
  draftSpec.value = setWindowLayoutConstraint(activeSpec.value, geometryForDraft(), edge, anchor.target, { value: convertWindowLayoutValue(rawPixels, 'px', nextUnit, availableFor(edgeAxis(edge))), unit: nextUnit })
  previewDraft()
}
function updateDistance(edge: WindowLayoutEdge, event: Event): void {
  startEdit()
  const anchor = anchorFor(edge)
  if (!anchor || !activeSpec.value) return
  const draft = constraintDrafts[edge]
  draft.value = (event.target as HTMLInputElement).value
  try {
    const gap = parseNumber(draft.value, 'Distance')
    const gapPixels = convertWindowLayoutValue(gap, draft.unit, 'px', availableFor(edgeAxis(edge)))
    const rawPixels = isOpposite(edge, anchor.target.edge) && (edge === 'right' || edge === 'bottom') ? -gapPixels : gapPixels
    draftSpec.value = setWindowLayoutConstraint(activeSpec.value, geometryForDraft(), edge, anchor.target, { value: convertWindowLayoutValue(rawPixels, 'px', draft.unit, availableFor(edgeAxis(edge))), unit: draft.unit })
    previewDraft()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Invalid distance'; emit('preview', null) }
}
function parseTarget(value: string, edge: WindowLayoutEdge): WindowLayoutAnchor['target'] {
  const parts = value.split(':')
  const targetEdge = parts.at(-1) as WindowLayoutEdge
  if (!['left', 'right', 'top', 'bottom'].includes(targetEdge) || edgeAxis(targetEdge) !== edgeAxis(edge)) throw new Error('Target edge is not valid for this axis')
  if (value.startsWith('workspace:')) return { kind: 'workspace', edge: targetEdge }
  const instanceId = parts.slice(1, -1).join(':')
  if (!instanceId || !props.windows.some((window) => window.instanceId === instanceId)) throw new Error('Target window is no longer available')
  return { kind: 'window', instanceId, edge: targetEdge }
}
function updateTargetValue(edge: WindowLayoutEdge, value: string): void {
  startEdit()
  const anchor = anchorFor(edge)
  if (!anchor || !activeSpec.value) return
  try {
    const target = parseTarget(value, edge)
    const raw = anchor.offset ?? { value: 0, unit: 'px' as const }
    draftSpec.value = setWindowLayoutConstraint(activeSpec.value, geometryForDraft(), edge, target, raw)
    previewDraft()
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Invalid target'; emit('preview', null) }
}
function updateTarget(edge: WindowLayoutEdge, event: Event): void { updateTargetValue(edge, (event.target as HTMLSelectElement).value) }
function updateTargetEdge(edge: WindowLayoutEdge, event: Event): void {
  const anchor = anchorFor(edge)
  if (!anchor) return
  const target = targetHostValue(edge)
  updateTargetValue(edge, `${target}:${(event.target as HTMLSelectElement).value}`)
}
function disconnect(edge: WindowLayoutEdge): void {
  startEdit()
  if (!activeSpec.value || !currentWindow.value) return
  draftSpec.value = removeWindowLayoutConstraint(activeSpec.value, geometryForDraft(), edge)
  previewDraft()
  commitEdit()
}
function commitEdit(): void {
  const window = currentWindow.value
  if (!window || !editing.value || errorMessage.value) return
  const geometry = draftGeometry.value ?? window.geometry
  emit('save', { layoutSpec: draftSpec.value, geometry })
  editing.value = false
  draftSpec.value = null
  draftGeometry.value = null
  emit('preview', null)
}
function cancelEdit(): void {
  if (!editing.value) return
  editing.value = false
  draftSpec.value = null
  draftGeometry.value = null
  errorMessage.value = ''
  emit('preview', null)
  emit('cancel')
}
function onFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget
  if (next instanceof Node && root.value?.contains(next)) return
  commitEdit()
}
function commitOnBlur(event: FocusEvent): void {
  const next = event.relatedTarget
  if (next instanceof Node && root.value?.contains(next)) return
  commitEdit()
}
function onKeydown(event: KeyboardEvent): void {
  if (cancelInspectorDrag(event)) return
  if (event.key === 'Escape') { event.preventDefault(); cancelEdit() }
  if (event.key === 'Enter' && (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) { event.preventDefault(); commitEdit() }
}
function anchorDisplayLabel(edge: WindowLayoutEdge): string { return isOpposite(edge, targetEdgeValue(edge)) ? 'Distance' : 'Offset' }
function sizeReadOnly(axis: WindowLayoutAxis): boolean { return modeFor(axis) === 'stretch' || modeFor(axis) === 'free' }
function positionReadOnly(): boolean { return isResponsive.value }
function axisModeLabel(axis: WindowLayoutAxis): string { return modeFor(axis) === 'free' ? 'Free geometry' : modeFor(axis) === 'stretch' ? 'Stretch · calculated size' : modeFor(axis) === 'start-size' ? 'Start + size' : 'End + size' }
function editorElement(): HTMLElement | null {
  return root.value?.parentElement ?? null
}
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
function clampFloatingPosition(position: InspectorFloatingPosition): InspectorFloatingPosition {
  const inspector = root.value
  const editor = editorElement()
  if (!inspector || !editor) return { x: position.x, y: position.y }
  const editorRect = editor.getBoundingClientRect()
  const inspectorRect = inspector.getBoundingClientRect()
  if (editorRect.width <= 0 || editorRect.height <= 0) return { x: position.x, y: position.y }
  const width = inspectorRect.width || 360
  const height = inspectorRect.height || 240
  const headerHeight = header.value?.getBoundingClientRect().height || 44
  const margin = 8
  const maxX = Math.max(margin, editorRect.width - width - margin)
  const maxY = Math.max(margin, editorRect.height - Math.min(height, headerHeight) - margin)
  return { x: clamp(position.x, margin, maxX), y: clamp(position.y, margin, maxY) }
}
function emitFloatingPosition(position: InspectorFloatingPosition): void {
  const next = clampFloatingPosition(position)
  floatingPosition.value = next
  emit('floatingPositionChange', next)
}
function positionFromRenderedInspector(): InspectorFloatingPosition {
  const inspector = root.value
  const editor = editorElement()
  if (!inspector || !editor) return floatingPosition.value
  const inspectorRect = inspector.getBoundingClientRect()
  const editorRect = editor.getBoundingClientRect()
  if (inspectorRect.width <= 0 || inspectorRect.height <= 0 || editorRect.width <= 0 || editorRect.height <= 0) return floatingPosition.value
  return { x: inspectorRect.left - editorRect.left, y: inspectorRect.top - editorRect.top }
}
function defaultFloatingPosition(): InspectorFloatingPosition {
  const editor = editorElement()
  const inspector = root.value
  if (!editor || !inspector) return floatingPosition.value
  const editorRect = editor.getBoundingClientRect()
  const inspectorRect = inspector.getBoundingClientRect()
  if (editorRect.width <= 0 || editorRect.height <= 0 || inspectorRect.width <= 0) return floatingPosition.value
  return clampFloatingPosition({ x: editorRect.width - inspectorRect.width - 16, y: inspectorRect.top - editorRect.top })
}
function setInspectorMode(next: InspectorMode): void {
  if (next !== 'minimized') lastExpandedMode.value = next
  inspectorMode.value = next
  emit('modeChange', next)
  if (next === 'minimized') {
    nextTick(() => restoreControl.value?.focus())
  } else {
    nextTick(() => header.value?.focus())
  }
}
function toggleDockMode(): void {
  if (inspectorMode.value === 'floating') {
    setInspectorMode('docked')
    return
  }
  if (inspectorMode.value === 'docked') {
    emitFloatingPosition(defaultFloatingPosition())
    setInspectorMode('floating')
  }
}
function toggleMinimized(): void {
  if (inspectorMode.value === 'minimized') setInspectorMode(lastExpandedMode.value)
  else setInspectorMode('minimized')
}
function beginInspectorDrag(event: PointerEvent): void {
  if (inspectorMode.value !== 'floating' || event.button !== 0) return
  const target = event.target
  if (target instanceof Element && target.closest('button, input, select, textarea, a, [data-layout-inspector-action]')) return
  const captureTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : header.value
  if (!captureTarget) return
  event.preventDefault()
  event.stopPropagation()
  const pointerId = typeof event.pointerId === 'number' ? event.pointerId : undefined
  const rendered = positionFromRenderedInspector()
  const session: DragSession = { pointerId, startX: event.clientX, startY: event.clientY, startPosition: rendered }
  dragSession = session
  const matches = (next: PointerEvent): boolean => pointerId === undefined || typeof next.pointerId !== 'number' || next.pointerId === pointerId
  const move = (next: PointerEvent): void => {
    if (!matches(next)) return
    emitFloatingPosition({ x: session.startPosition.x + next.clientX - session.startX, y: session.startPosition.y + next.clientY - session.startY })
  }
  const end = (next: PointerEvent): void => {
    if (!matches(next)) return
    if (next.type !== 'pointerup') emitFloatingPosition(session.startPosition)
    cleanup()
  }
  const lost = (): void => { emitFloatingPosition(session.startPosition); cleanup() }
  const cleanup = (): void => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    window.removeEventListener('blur', cancel)
    captureTarget.removeEventListener('lostpointercapture', lost)
    if (pointerId !== undefined && typeof captureTarget.releasePointerCapture === 'function') {
      try { captureTarget.releasePointerCapture(pointerId) } catch { /* optional */ }
    }
    dragSession = null
    disposeDrag = null
  }
  const cancel = (): void => { emitFloatingPosition(session.startPosition); cleanup() }
  disposeDrag = cleanup
  if (pointerId !== undefined && typeof captureTarget.setPointerCapture === 'function') {
    try { captureTarget.setPointerCapture(pointerId) } catch { /* optional */ }
  }
  captureTarget.addEventListener('lostpointercapture', lost)
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
  window.addEventListener('blur', cancel)
}
function cancelInspectorDrag(event: KeyboardEvent): boolean {
  if (!dragSession || event.key !== 'Escape') return false
  event.preventDefault()
  emitFloatingPosition(dragSession.startPosition)
  disposeDrag?.()
  return true
}
function clampInspectorAfterResize(): void {
  if (inspectorMode.value === 'floating') emitFloatingPosition(floatingPosition.value)
}
function initialize(): void {
  draftSpec.value = null; draftGeometry.value = null; editing.value = false; errorMessage.value = ''
  syncDraftFields()
}

watch(() => props.window?.instanceId, initialize, { immediate: true })
watch(() => props.window, () => { if (!editing.value) syncDraftFields() }, { deep: true })
watch(() => props.mode, (next) => {
  if (next && next !== inspectorMode.value) inspectorMode.value = next
  if (next === 'floating' || next === 'docked') lastExpandedMode.value = next
})
watch(() => props.floatingPosition, (next) => {
  if (next) floatingPosition.value = { x: next.x, y: next.y }
}, { deep: true })
onMounted(() => window.addEventListener('resize', clampInspectorAfterResize))
onBeforeUnmount(() => {
  disposeDrag?.()
  window.removeEventListener('resize', clampInspectorAfterResize)
})

defineExpose({ cancelEdit })
</script>

<template>
  <aside ref="root" class="wf-layout-inspector" :class="{ 'wf-layout-inspector--collapsed': inspectorMode === 'minimized', 'wf-layout-inspector--floating': inspectorMode === 'floating', 'wf-layout-inspector--minimized': inspectorMode === 'minimized' }" :style="inspectorStyle" :data-layout-inspector-mode="inspectorMode" data-workspace-selection-actions data-layout-inspector aria-label="Layout Inspector" @focusout="onFocusOut" @blur.capture="commitOnBlur" @keydown="onKeydown">
    <template v-if="inspectorMode === 'minimized'">
      <div class="wf-layout-inspector__minimized" data-layout-inspector-minimized>
        <button ref="restoreControl" type="button" data-layout-inspector-toggle data-layout-inspector-restore aria-label="Restore layout inspector" @click="toggleMinimized"><span aria-hidden="true">☷</span><span class="wf-layout-inspector__minimized-label">Inspector</span></button>
        <small class="wf-layout-inspector__minimized-selection" data-selected-window-id aria-live="polite">{{ currentWindow?.instanceId ?? '' }}</small>
      </div>
    </template>
    <template v-else>
      <header ref="header" class="wf-layout-inspector__header" data-layout-inspector-header tabindex="-1" @pointerdown="beginInspectorDrag">
        <div class="wf-layout-inspector__identity"><span class="wf-layout-inspector__grip" data-layout-inspector-grip role="button" tabindex="0" aria-label="Move layout inspector" aria-describedby="layout-inspector-mobility-help">⠿</span><div><strong v-if="currentWindow" data-selected-window-title>{{ currentWindow.title }}</strong><strong v-else>Layout Inspector</strong><small v-if="currentWindow" data-selected-window-id>{{ currentWindow.instanceId }}</small></div></div>
        <div class="wf-layout-inspector__header-actions"><div v-if="currentWindow" class="wf-layout-inspector__status" data-window-layout-status><span data-window-layout-surface>{{ surfaceLabel }}</span><span aria-hidden="true">·</span><span data-window-layout-rule>{{ ruleLabel }}</span></div><button type="button" data-layout-inspector-dock :aria-label="inspectorMode === 'floating' ? 'Dock layout inspector to right' : 'Undock layout inspector'" @click="toggleDockMode">{{ inspectorMode === 'floating' ? 'Dock' : 'Undock' }}</button><button type="button" data-layout-inspector-toggle data-layout-inspector-minimize aria-expanded="true" aria-label="Minimize layout inspector" @click="toggleMinimized">Minimize</button></div>
      </header>
      <p id="layout-inspector-mobility-help" class="wf-layout-inspector__mobility-help">Drag the header to move the floating inspector.</p>
      <template v-if="currentWindow">
      <div class="wf-layout-inspector__actions">
        <button class="wf-workspace-selection-actions__layout" type="button" data-window-selection-layout :aria-label="`Advanced layout for ${currentWindow.title}`" @click="emit('layout', currentWindow.instanceId)">Advanced layout…</button>
        <button class="wf-workspace-selection-actions__toggle" type="button" data-window-selection-lock :aria-pressed="currentWindow.layoutLocked ? 'true' : 'false'" :aria-label="`${currentWindow.layoutLocked ? 'Unlock' : 'Lock'} window ${currentWindow.title}`" :title="`${currentWindow.layoutLocked ? 'Unlock' : 'Lock'} window ${currentWindow.title}`" @click="currentWindow.layoutLocked ? emit('unlock', currentWindow.instanceId) : emit('lock', currentWindow.instanceId)">{{ currentWindow.layoutLocked ? 'Unlock' : 'Lock' }}</button>
      </div>
      <p v-if="errorMessage" class="wf-layout-inspector__error" data-layout-inspector-error role="alert">{{ errorMessage }}</p>
      <fieldset data-layout-inspector-position><legend>Position</legend><template v-if="positionReadOnly()"><label>X <output data-layout-inspector-x>{{ Math.round(geometryForDraft().position.x) }} px · Calculated</output></label><label>Y <output data-layout-inspector-y>{{ Math.round(geometryForDraft().position.y) }} px · Calculated</output></label></template><template v-else><label>X <input data-layout-inspector-x :value="freeDraft.x" type="number" step="any" @focus="startEdit" @input="updateFree('x', $event)" /></label><label>Y <input data-layout-inspector-y :value="freeDraft.y" type="number" step="any" @focus="startEdit" @input="updateFree('y', $event)" /></label></template></fieldset>
      <fieldset data-layout-inspector-size><legend>Size</legend><template v-if="isResponsive"><template v-for="axis in (['horizontal', 'vertical'] as const)" :key="axis"><label>{{ axis === 'horizontal' ? 'Width' : 'Height' }} <template v-if="sizeReadOnly(axis)"><output :data-layout-derived-size="axis">{{ Math.round(axisSize(axis)) }} px · Calculated</output></template><template v-else><input :data-layout-size="axis" :value="axisSizeValue(axis)" type="number" step="any" min="0" @focus="startEdit" @input="updateSize(axis, $event)" /><select :data-layout-size-unit="axis" :value="axisSizeUnit(axis)" @focus="startEdit" @change="updateSizeUnit(axis, $event)"><option value="px">px</option><option value="percent">%</option></select></template></label></template></template><template v-else><label>Width <input data-layout-inspector-width :value="freeDraft.width" type="number" step="any" min="0" @focus="startEdit" @input="updateFree('width', $event)" /></label><label>Height <input data-layout-inspector-height :value="freeDraft.height" type="number" step="any" min="0" @focus="startEdit" @input="updateFree('height', $event)" /></label></template></fieldset>
      <dl class="wf-layout-inspector__geometry" data-window-geometry><div><dt>X</dt><dd>{{ Math.round(geometryForDraft().position.x) }} px</dd></div><div><dt>Y</dt><dd>{{ Math.round(geometryForDraft().position.y) }} px</dd></div><div><dt>W</dt><dd>{{ Math.round(geometryForDraft().size.width) }} px</dd></div><div><dt>H</dt><dd>{{ Math.round(geometryForDraft().size.height) }} px</dd></div></dl>
      <fieldset v-for="(edges, axis) in { horizontal: horizontalEdges, vertical: verticalEdges }" :key="axis" :data-layout-inspector-constraints="axis"><legend>{{ axis === 'horizontal' ? 'Horizontal' : 'Vertical' }} constraints</legend><p class="wf-layout-inspector__mode" :data-layout-axis-mode="axis">{{ axisModeLabel(axis) }}</p><template v-for="edge in edges" :key="edge"><article v-if="anchorFor(edge)" class="wf-layout-inspector__constraint" :class="{ 'wf-layout-inspector__constraint--selected': selectedConstraintEdge === edge }" :data-window-constraint-card="edge" @click="emit('constraintSelect', edge)"><header><strong>{{ edge }} edge</strong><span>{{ anchorDisplayLabel(edge) }}</span></header><small class="wf-layout-inspector__target-label" data-layout-constraint-target-label>{{ targetLabel(anchorFor(edge)!) }}</small><label>Target <select :data-layout-constraint-target="edge" :value="`${targetValue(anchorFor(edge)!) }:${targetEdgeValue(edge)}`" @focus="startEdit" @change="updateTarget(edge, $event)"><option v-for="option in targetOptions(edge)" :key="option.value" :value="option.value">{{ option.label }}</option></select></label><label>Target edge <select :data-layout-constraint-target-edge="edge" :value="targetEdgeValue(edge)" @focus="startEdit" @change="updateTargetEdge(edge, $event)"><option v-for="targetEdge in (edgeAxis(edge) === 'horizontal' ? horizontalEdges : verticalEdges)" :key="targetEdge" :value="targetEdge">{{ targetEdge }}</option></select></label><label>{{ anchorDisplayLabel(edge) }} <input :data-layout-constraint-offset="edge" type="number" step="any" :value="rounded(displayValue(edge))" @focus="startEdit" @input="updateDistance(edge, $event)" /><select :data-layout-constraint-unit="edge" :value="constraintDrafts[edge].unit" @focus="startEdit" @change="updateDistanceUnit(edge, $event)"><option value="px">px</option><option value="percent">%</option></select></label><button type="button" :data-layout-constraint-disconnect="edge" @click.stop="disconnect(edge)">Remove {{ edge }} constraint</button></article></template><p v-if="!edges.some((edge) => anchorFor(edge))" class="wf-layout-inspector__empty">No direct constraints on this axis.</p></fieldset>
      <fieldset data-layout-inspector-minmax><legend>Size constraints</legend><dl><div><dt>Min W × H</dt><dd>{{ currentWindow.constraints.minSize.width }} × {{ currentWindow.constraints.minSize.height }} px</dd></div><div><dt>Max W × H</dt><dd>{{ currentWindow.constraints.maxSize ? `${currentWindow.constraints.maxSize.width} × ${currentWindow.constraints.maxSize.height} px` : 'none' }}</dd></div></dl></fieldset>
      </template>
      <div v-else class="wf-layout-inspector__empty-state" data-layout-inspector-empty>Select a window to edit its layout.</div>
    </template>
  </aside>
</template>

<style scoped>
.wf-layout-inspector { position: absolute; top: calc(var(--wf-space-sm) + var(--wf-size-control-height) + var(--wf-space-xs)); right: var(--wf-space-sm); bottom: var(--wf-space-sm); z-index: calc(var(--wf-layer-overlay) + 3); box-sizing: border-box; display: grid; align-content: start; width: min(360px, calc(100% - var(--wf-space-md))); max-width: calc(100% - var(--wf-space-md)); gap: var(--wf-space-sm); padding: var(--wf-space-md); overflow: auto; border: 1px solid var(--wf-color-border-floating); border-radius: var(--wf-radius-md); background: var(--wf-color-surface-floating); box-shadow: var(--wf-shadow-md); color: var(--wf-color-text); }
.wf-layout-inspector--floating { right: auto; bottom: auto; max-height: calc(100% - var(--wf-space-md)); }
.wf-layout-inspector__header, .wf-layout-inspector__actions, .wf-layout-inspector__constraint header { display: flex; align-items: center; justify-content: space-between; gap: var(--wf-space-xs); }
.wf-layout-inspector__header { cursor: default; }
.wf-layout-inspector--floating .wf-layout-inspector__header { cursor: move; touch-action: none; }
.wf-layout-inspector__header-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: var(--wf-space-2xs); }
.wf-layout-inspector__grip { display: inline-grid; width: var(--wf-size-icon-button-size); height: var(--wf-size-icon-button-size); place-items: center; color: var(--wf-color-text-muted); font-size: var(--wf-font-size-md); cursor: move; }
.wf-layout-inspector__grip:focus-visible { outline: 2px solid var(--wf-color-focus); outline-offset: 1px; }
.wf-layout-inspector__mobility-help { margin: calc(var(--wf-space-xs) * -1) 0 0; color: var(--wf-color-text-muted); font-size: var(--wf-font-size-xs); }
.wf-layout-inspector--minimized { top: calc(var(--wf-space-sm) + var(--wf-size-control-height) + var(--wf-space-xs)); right: var(--wf-space-sm); bottom: auto; width: auto; min-width: 0; padding: var(--wf-space-2xs); overflow: visible; }
.wf-layout-inspector--collapsed { width: auto; min-width: 0; bottom: auto; }
.wf-layout-inspector__minimized { display: inline-flex; }
.wf-layout-inspector__minimized button { display: inline-flex; align-items: center; gap: var(--wf-space-2xs); min-width: var(--wf-size-control-height); min-height: var(--wf-size-control-height); padding: 0 var(--wf-space-xs); }
.wf-layout-inspector__minimized-selection { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.wf-layout-inspector__identity { display: grid; min-width: 0; gap: var(--wf-space-2xs); }
.wf-layout-inspector__identity strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wf-layout-inspector__identity small, .wf-layout-inspector__status, .wf-layout-inspector__mode, .wf-layout-inspector__empty, .wf-layout-inspector__constraint header span { color: var(--wf-color-text-muted); font-size: var(--wf-font-size-xs); }
.wf-layout-inspector__status { display: inline-flex; gap: var(--wf-space-2xs); white-space: nowrap; }
.wf-layout-inspector fieldset { display: grid; gap: var(--wf-space-xs); margin: 0; padding: var(--wf-space-sm); border: 1px solid var(--wf-color-border); border-radius: var(--wf-radius-sm); }
.wf-layout-inspector legend { padding: 0 var(--wf-space-xs); color: var(--wf-color-text-muted); font-size: var(--wf-font-size-xs); }
.wf-layout-inspector label { display: grid; grid-template-columns: minmax(80px, .7fr) minmax(0, 1.3fr); align-items: center; gap: var(--wf-space-xs); font-size: var(--wf-font-size-xs); }
.wf-layout-inspector label:has(select) { grid-template-columns: minmax(80px, .7fr) minmax(0, 1fr) auto; }
.wf-layout-inspector input, .wf-layout-inspector select, .wf-layout-inspector button { min-width: 0; min-height: var(--wf-size-control-height-compact); padding: 0 var(--wf-space-xs); border: 1px solid var(--wf-color-border); border-radius: var(--wf-radius-sm); background: var(--wf-color-surface-raised); color: var(--wf-color-text); font: inherit; font-size: var(--wf-font-size-xs); }
.wf-layout-inspector button { cursor: pointer; }
.wf-layout-inspector button:hover, .wf-layout-inspector button:focus-visible, .wf-layout-inspector input:focus-visible, .wf-layout-inspector select:focus-visible { border-color: var(--wf-color-focus); outline: 2px solid var(--wf-color-focus); outline-offset: 1px; }
.wf-layout-inspector__constraint { display: grid; gap: var(--wf-space-2xs); padding: var(--wf-space-xs); border: 1px solid var(--wf-color-border-floating); border-radius: var(--wf-radius-sm); background: var(--wf-color-surface-raised); }
.wf-layout-inspector__constraint--selected { border-color: var(--wf-color-focus); box-shadow: 0 0 0 1px var(--wf-color-focus); }
.wf-layout-inspector__target-label { color: var(--wf-color-text-muted); }
.wf-layout-inspector__constraint button { color: var(--wf-color-danger); }
.wf-layout-inspector__error { margin: 0; padding: var(--wf-space-xs); border-left: 3px solid var(--wf-color-warning); color: var(--wf-color-warning); font-size: var(--wf-font-size-xs); }
.wf-layout-inspector dl { display: grid; gap: var(--wf-space-2xs); margin: 0; font-size: var(--wf-font-size-xs); }
.wf-layout-inspector dl div { display: flex; justify-content: space-between; gap: var(--wf-space-sm); }
.wf-layout-inspector dt { color: var(--wf-color-text-muted); }
.wf-layout-inspector dd { margin: 0; }
.wf-layout-inspector output { color: var(--wf-color-text-muted); }
.wf-layout-inspector__empty-state { display: grid; min-height: 120px; place-items: center; color: var(--wf-color-text-muted); text-align: center; }
@media (max-width: 720px) { .wf-layout-inspector { width: min(360px, calc(100% - var(--wf-space-md))); } .wf-layout-inspector__minimized-label { display: none; } }
</style>
