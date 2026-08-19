<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, shallowRef, watch } from 'vue'
import { captureWidgetForgeDevToolsSnapshot, type DevToolsPaneDiagnostic, type WidgetForgeDevToolsSnapshot } from '../core/devtools'
import type { DockManager } from '../core/dock-manager'
import type { WindowManager } from '../core/window-manager'
import type { DataClient } from '../data/data-client'

interface Props {
  windows: WindowManager
  docks?: DockManager | undefined
  dataClient?: DataClient | undefined
  enabled?: boolean
  shortcut?: string
  target?: HTMLElement | null | undefined
  showWorkspaceJson?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  enabled: false,
  shortcut: 'Ctrl+Shift+D',
  target: null,
  showWorkspaceJson: true,
})
const emit = defineEmits<{ open: []; close: []; copied: [json: string] }>()

type OverlayMode = 'all' | 'selected' | 'hovered'
type OverlayMarkKind = 'window' | 'dock' | 'pane' | 'widget' | 'drop-zone'
type OverlayFilterKind = Exclude<OverlayMarkKind, 'drop-zone'>
const filterOptions: readonly { kind: OverlayFilterKind; label: string }[] = [
  { kind: 'window', label: 'Windows' },
  { kind: 'dock', label: 'Docks' },
  { kind: 'pane', label: 'Panes' },
  { kind: 'widget', label: 'Widget hosts' },
]

interface VisualMark {
  readonly key: string
  readonly kind: OverlayMarkKind
  readonly label: string
  readonly focused: boolean
  readonly style: Readonly<Record<string, string>>
}

const open = shallowRef(false)
const mode = shallowRef<OverlayMode>('all')
const inspectMode = shallowRef(false)
const selectedKey = shallowRef<string | null>(null)
const hoveredKey = shallowRef<string | null>(null)
const filters = reactive<Record<OverlayFilterKind, boolean>>({ window: true, dock: true, pane: true, widget: true })
const snapshot = shallowRef<WidgetForgeDevToolsSnapshot>(captureWidgetForgeDevToolsSnapshot(props.windows, props.docks, props.dataClient))
const marks = shallowRef<readonly VisualMark[]>([])
let disposers: Array<() => void> = []
let observer: MutationObserver | null = null

const workspaceJson = computed(() => JSON.stringify(snapshot.value.workspace, null, 2))
const activeHighlightKey = computed(() => mode.value === 'selected' ? selectedKey.value : mode.value === 'hovered' ? hoveredKey.value : null)

function parseShortcut(shortcut: string): { key: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean } {
  const parts = shortcut.toLowerCase().split('+').map((part) => part.trim()).filter(Boolean)
  return {
    key: parts.at(-1) ?? '',
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt') || parts.includes('option'),
    meta: parts.includes('cmd') || parts.includes('command') || parts.includes('meta'),
  }
}
function matchesShortcut(event: KeyboardEvent): boolean {
  const shortcut = parseShortcut(props.shortcut)
  return event.key.toLowerCase() === shortcut.key
    && event.ctrlKey === shortcut.ctrl
    && event.shiftKey === shortcut.shift
    && event.altKey === shortcut.alt
    && event.metaKey === shortcut.meta
}
function root(): Document | HTMLElement { return props.target ?? document }
function withinRoot(element: Element): boolean { return !props.target || props.target === element || props.target.contains(element) }
function elements(selector: string): HTMLElement[] { return [...root().querySelectorAll<HTMLElement>(selector)] }
function markStyle(rect: DOMRect): Record<string, string> {
  return { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` }
}
function labelStyle(rect: DOMRect, order: number, focused: boolean): Record<string, string> {
  const compact = rect.width < 140 || rect.height < 28
  const outside = compact && rect.top >= 20
  const stagger = focused ? 0 : (order % 3) * 14
  return {
    '--wf-devtools-label-top': outside ? '-18px' : `${2 + stagger}px`,
    '--wf-devtools-label-left': `${focused ? 2 : Math.min(stagger / 2, Math.max(0, rect.width - 32))}px`,
  }
}
function paneSelectionKey(pane: DevToolsPaneDiagnostic): string { return `pane:${pane.ownerKind}:${pane.ownerId}:${pane.path.join('/')}` }
function widgetSelectionKey(pane: DevToolsPaneDiagnostic): string { return `widget:${paneSelectionKey(pane)}` }
function windowSelectionKey(instanceId: string): string { return `window:${instanceId}` }
function dockSelectionKey(id: string): string { return `dock:${id}` }
function ownerFor(element: Element): { kind: 'window' | 'dock'; id: string } | null {
  const windowElement = element.closest<HTMLElement>('.wf-window-frame[data-window-instance-id]')
  if (windowElement?.dataset.windowInstanceId && withinRoot(windowElement)) return { kind: 'window', id: windowElement.dataset.windowInstanceId }
  const dockElement = element.closest<HTMLElement>('[data-dock-id]')
  if (dockElement?.dataset.dockId && withinRoot(dockElement)) return { kind: 'dock', id: dockElement.dataset.dockId }
  return null
}
function paneDiagnosticFor(element: Element): DevToolsPaneDiagnostic | null {
  const paneId = element instanceof HTMLElement ? element.dataset.paneId : undefined
  if (!paneId) return null
  const owner = ownerFor(element)
  return snapshot.value.panes.find((pane) => pane.id === paneId && (!owner || (pane.ownerKind === owner.kind && pane.ownerId === owner.id)))
    ?? snapshot.value.panes.find((pane) => pane.id === paneId)
    ?? null
}
function widgetDiagnosticFor(element: Element): DevToolsPaneDiagnostic | null {
  const instanceId = element instanceof HTMLElement ? element.dataset.widgetInstanceId : undefined
  if (!instanceId) return null
  const owner = ownerFor(element)
  return snapshot.value.panes.find((pane) => pane.kind === 'widget' && pane.instanceId === instanceId && (!owner || (pane.ownerKind === owner.kind && pane.ownerId === owner.id)))
    ?? snapshot.value.panes.find((pane) => pane.kind === 'widget' && pane.instanceId === instanceId)
    ?? null
}
function paneKeyForElement(element: Element): string {
  const diagnostic = paneDiagnosticFor(element)
  return diagnostic ? paneSelectionKey(diagnostic) : `pane:${(element as HTMLElement).dataset.paneId ?? 'unknown'}`
}
function widgetKeyForElement(element: Element): string {
  const diagnostic = widgetDiagnosticFor(element)
  return diagnostic ? widgetSelectionKey(diagnostic) : `widget:${(element as HTMLElement).dataset.widgetInstanceId ?? 'unknown'}`
}
function keyForElement(element: Element): string | null {
  const widget = element.closest<HTMLElement>('[data-widget-instance-id]')
  if (widget && withinRoot(widget)) return widgetKeyForElement(widget)
  const pane = element.closest<HTMLElement>('[data-pane-id]')
  if (pane && withinRoot(pane)) return paneKeyForElement(pane)
  const window = element.closest<HTMLElement>('.wf-window-frame[data-window-instance-id]')
  if (window && withinRoot(window) && window.dataset.windowInstanceId) return windowSelectionKey(window.dataset.windowInstanceId)
  const dock = element.closest<HTMLElement>('[data-dock-id]')
  if (dock && withinRoot(dock) && dock.dataset.dockId) return dockSelectionKey(dock.dataset.dockId)
  return null
}
function addMark(next: VisualMark[], kind: OverlayMarkKind, key: string, label: string, element: HTMLElement, focused = false): void {
  const rect = element.getBoundingClientRect()
  next.push({ key, kind, label, focused, style: { ...markStyle(rect), ...labelStyle(rect, next.length, focused) } })
}
function windowElements(): HTMLElement[] {
  const frames = elements('.wf-window-frame[data-window-instance-id]')
  return frames.length > 0 ? frames : elements('[data-window-instance-id]')
}
function paneElements(): HTMLElement[] {
  const panes = elements('.wf-pane-host[data-pane-id]')
  return panes.length > 0 ? panes : elements('[data-pane-id]')
}
function refreshMarks(): void {
  if (!props.enabled || !open.value) { marks.value = []; return }
  const next: VisualMark[] = []
  for (const element of windowElements()) {
    const id = element.dataset.windowInstanceId ?? 'window'
    const diagnostic = snapshot.value.windows.find((window) => window.instanceId === id)
    addMark(next, 'window', windowSelectionKey(id), `${id} · z${element.dataset.windowZIndex ?? diagnostic?.zIndex ?? '?'} · ${element.dataset.windowLayer ?? diagnostic?.layer ?? 'normal'}`, element, diagnostic?.focused ?? false)
  }
  for (const element of elements('[data-dock-id]')) {
    const id = element.dataset.dockId ?? 'dock'
    const diagnostic = snapshot.value.docks.find((dock) => dock.id === id)
    addMark(next, 'dock', dockSelectionKey(id), `${id} · ${element.dataset.dockPosition ?? diagnostic?.position ?? '?'}`, element)
  }
  for (const element of paneElements()) {
    const id = element.dataset.paneId ?? 'pane'
    const diagnostic = paneDiagnosticFor(element)
    const rect = element.getBoundingClientRect()
    const focused = element.dataset.paneFocused === 'true'
    addMark(next, 'pane', paneKeyForElement(element), `${id} · ${element.dataset.paneKind ?? diagnostic?.kind ?? '?'} · ${Math.round(rect.width)}×${Math.round(rect.height)}${focused ? ' · focused' : ''}`, element, focused)
  }
  for (const element of elements('[data-widget-instance-id]')) {
    const diagnostic = widgetDiagnosticFor(element)
    const id = element.dataset.widgetInstanceId ?? 'widget'
    addMark(next, 'widget', widgetKeyForElement(element), `${element.dataset.widgetId ?? diagnostic?.widgetId ?? '?'} · ${id}`, element)
  }
  for (const element of elements('[data-docking-active-zone]')) {
    addMark(next, 'drop-zone', `drop:${element.dataset.dockingSource ?? ''}:${element.dataset.dockingTarget ?? ''}:${element.dataset.dockingActiveZone ?? ''}`, `drop · ${element.dataset.dockingActiveZone ?? '?'}`, element)
  }
  const keys = new Set(next.map((mark) => mark.key))
  if (selectedKey.value && !keys.has(selectedKey.value)) selectedKey.value = null
  if (hoveredKey.value && !keys.has(hoveredKey.value)) hoveredKey.value = null
  if (mode.value === 'selected' && !selectedKey.value) {
    selectedKey.value = next.find((mark) => mark.kind === 'pane' && mark.focused)?.key
      ?? next.find((mark) => mark.kind === 'window' && mark.focused)?.key
      ?? null
  }
  marks.value = next
}
function refresh(): void {
  snapshot.value = captureWidgetForgeDevToolsSnapshot(props.windows, props.docks, props.dataClient)
  refreshMarks()
}
function stopObserver(): void { observer?.disconnect(); observer = null }
function startObserver(): void {
  stopObserver()
  if (!props.enabled || !open.value || typeof MutationObserver === 'undefined') return
  const observed = props.target ?? document.body
  if (!observed) return
  observer = new MutationObserver(refreshMarks)
  observer.observe(observed, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-pane-focused', 'data-pane-active', 'data-pane-visible', 'data-window-z-index', 'data-window-layer', 'data-dock-id', 'data-widget-instance-id', 'data-widget-id', 'data-docking-active-zone'] })
}
function openOverlay(): void {
  if (!props.enabled || open.value) return
  open.value = true
  refresh()
  void nextTick(() => { refreshMarks(); startObserver() })
  emit('open')
}
function closeOverlay(): void {
  if (!open.value) return
  open.value = false
  stopObserver()
  hoveredKey.value = null
  marks.value = []
  emit('close')
}
function toggle(): void { if (open.value) closeOverlay(); else openOverlay() }
function onKeydown(event: KeyboardEvent): void {
  if (!matchesShortcut(event)) return
  event.preventDefault()
  toggle()
}
function onPointerMove(event: Event): void {
  if (!open.value || mode.value !== 'hovered') return
  const target = event.target
  if (!(target instanceof Element) || target.closest('[data-widgetforge-devtools], [data-devtools-visual-overlay]')) return
  const next = keyForElement(target)
  if (next !== hoveredKey.value) hoveredKey.value = next
}
function install(): void {
  cleanup()
  if (!props.enabled) return
  const eventRoot = root()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', refreshMarks)
  eventRoot.addEventListener('pointermove', onPointerMove)
  disposers = [
    props.windows.subscribe(refresh),
    ...(props.docks ? [props.docks.subscribe(refresh)] : []),
    ...(props.dataClient ? [props.dataClient.subscribeDiagnostics(refresh)] : []),
    () => window.removeEventListener('keydown', onKeydown),
    () => window.removeEventListener('resize', refreshMarks),
    () => eventRoot.removeEventListener('pointermove', onPointerMove),
  ]
  refresh()
}
function cleanup(): void {
  stopObserver()
  for (const dispose of disposers.splice(0)) dispose()
}
function selectNode(key: string): void { selectedKey.value = key; mode.value = 'selected' }
function selectMark(mark: VisualMark): void { if (inspectMode.value) selectNode(mark.key) }
function setFilter(kind: OverlayFilterKind, event: Event): void {
  const target = event.target
  if (target instanceof HTMLInputElement) filters[kind] = target.checked
}
function setMode(event: Event): void {
  const target = event.target
  if (target instanceof HTMLSelectElement) mode.value = target.value as OverlayMode
}
async function copyWorkspaceJson(): Promise<void> {
  const json = workspaceJson.value
  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(json)
  else if (typeof document.execCommand === 'function') {
    const textarea = document.createElement('textarea')
    textarea.value = json
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.append(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
  emit('copied', json)
}
function isFiltered(mark: VisualMark): boolean { return mark.kind === 'drop-zone' || filters[mark.kind] }
watch(() => props.enabled, (enabled) => { if (!enabled) closeOverlay(); install() }, { immediate: true })
watch(() => [props.windows, props.docks, props.dataClient, props.target] as const, () => { install(); if (open.value) startObserver() })
watch(() => [mode.value, selectedKey.value, hoveredKey.value] as const, () => { if (open.value) refreshMarks() })
onBeforeUnmount(cleanup)
defineExpose({ open: openOverlay, close: closeOverlay, toggle, refresh })
</script>

<template>
  <template v-if="enabled">
    <div v-if="open" class="wf-devtools-marks" :data-inspect-mode="inspectMode ? 'true' : 'false'" aria-hidden="true" data-devtools-visual-overlay>
      <div v-for="mark in marks" v-show="isFiltered(mark)" :key="mark.key" class="wf-devtools-mark" :class="[`wf-devtools-mark--${mark.kind}`, { 'wf-devtools-mark--selected': activeHighlightKey === mark.key }]" :style="mark.style" :data-devtools-node="mark.key" :data-devtools-selected="activeHighlightKey === mark.key ? 'true' : undefined" @click.stop.prevent="selectMark(mark)"><span>{{ mark.label }}</span></div>
    </div>
    <aside v-if="open" class="wf-devtools" data-widgetforge-devtools aria-label="WidgetForge developer tools">
      <header><strong>WidgetForge DevTools</strong><kbd>{{ shortcut }}</kbd><button type="button" aria-label="Close DevTools" @click="closeOverlay">×</button></header>
      <div class="wf-devtools__controls">
        <label>Overlay mode <select data-devtools-mode aria-label="Overlay mode" :value="mode" @change="setMode"><option value="all">All bounds</option><option value="selected">Selected node</option><option value="hovered">Hovered node</option></select></label>
        <label class="wf-devtools__inspect"><input data-devtools-inspect-mode type="checkbox" :checked="inspectMode" @change="inspectMode = ($event.target as HTMLInputElement).checked"> Inspect bounds</label>
      </div>
      <fieldset class="wf-devtools__filters"><legend>Visible bounds</legend><label v-for="filter in filterOptions" :key="filter.kind"><input :data-devtools-filter="filter.kind" type="checkbox" :checked="filters[filter.kind]" @change="setFilter(filter.kind, $event)">{{ filter.label }}</label></fieldset>
      <div class="wf-devtools__summary"><span>{{ snapshot.windows.length }} windows</span><span>{{ snapshot.docks.length }} docks</span><span>{{ snapshot.panes.length }} panes</span><span>{{ snapshot.data?.totalConsumers ?? 0 }} data consumers</span></div>
      <div class="wf-devtools__content">
        <details open><summary>Windows</summary><ul><li v-for="window in snapshot.windows" :key="window.instanceId"><button type="button" class="wf-devtools__node" :class="{ 'wf-devtools__node--selected': selectedKey === `window:${window.instanceId}` }" :data-devtools-select="`window:${window.instanceId}`" :aria-pressed="selectedKey === `window:${window.instanceId}`" @click="selectNode(`window:${window.instanceId}`)"><code>{{ window.instanceId }}</code><span>{{ window.mode }} · {{ window.layer }} · z{{ window.zIndex }}<template v-if="window.focused"> · focused</template></span><small>{{ window.geometry.position.x }},{{ window.geometry.position.y }} · {{ window.geometry.size.width }}×{{ window.geometry.size.height }}</small></button></li></ul></details>
        <details><summary>Docks</summary><ul><li v-for="dock in snapshot.docks" :key="dock.id"><button type="button" class="wf-devtools__node" :class="{ 'wf-devtools__node--selected': selectedKey === `dock:${dock.id}` }" :data-devtools-select="`dock:${dock.id}`" :aria-pressed="selectedKey === `dock:${dock.id}`" @click="selectNode(`dock:${dock.id}`)"><code>{{ dock.id }}</code><span>{{ dock.position }} · {{ dock.thickness }}px</span><small>root {{ dock.rootPaneId }}</small></button></li></ul></details>
        <details><summary>Pane tree</summary><ul><li v-for="pane in snapshot.panes" :key="`${pane.ownerKind}:${pane.ownerId}:${pane.path.join('/')}`" :style="{paddingLeft:`${pane.depth * 12}px`}"><button type="button" class="wf-devtools__node" :class="{ 'wf-devtools__node--selected': selectedKey === paneSelectionKey(pane) }" :data-devtools-select="paneSelectionKey(pane)" :aria-pressed="selectedKey === paneSelectionKey(pane)" @click="selectNode(paneSelectionKey(pane))"><code>{{ pane.id }}</code><span>{{ pane.kind }}<template v-if="pane.instanceId"> · {{ pane.instanceId }}</template></span><small>{{ pane.ownerKind }} {{ pane.ownerId }}</small></button></li></ul></details>
        <details><summary>Widget hosts</summary><ul><li v-for="pane in snapshot.panes.filter((candidate) => candidate.kind === 'widget')" :key="widgetSelectionKey(pane)"><button type="button" class="wf-devtools__node" :class="{ 'wf-devtools__node--selected': selectedKey === widgetSelectionKey(pane) }" :data-devtools-select="widgetSelectionKey(pane)" :aria-pressed="selectedKey === widgetSelectionKey(pane)" @click="selectNode(widgetSelectionKey(pane))"><code>{{ pane.instanceId }}</code><span>{{ pane.widgetId }}</span><small>{{ pane.ownerKind }} {{ pane.ownerId }}</small></button></li></ul></details>
        <details><summary>DataClient</summary><ul><li v-for="resource in snapshot.data?.resources ?? []" :key="resource.keyId"><code>{{ resource.key.kind }}:{{ resource.key.id }}</code><span>{{ resource.status }} · {{ resource.consumers }} consumers</span><small>{{ resource.subscribed ? 'subscribed' : resource.cached ? 'cached' : 'inactive' }}</small></li></ul><p v-if="!snapshot.data?.resources.length">No cached resources</p></details>
        <details v-if="showWorkspaceJson"><summary>Workspace JSON</summary><button type="button" data-devtools-copy @click="copyWorkspaceJson">Copy JSON</button><pre>{{ workspaceJson }}</pre></details>
      </div>
    </aside>
  </template>
</template>

<style scoped>
.wf-devtools-marks{position:fixed;inset:0;z-index:calc(var(--wf-layer-overlay) + 20);pointer-events:none}.wf-devtools-mark{position:fixed;box-sizing:border-box;border:1px dashed var(--wf-color-focus);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--wf-color-focus) 24%,transparent)}.wf-devtools-marks[data-inspect-mode="true"] .wf-devtools-mark{pointer-events:auto;cursor:crosshair}.wf-devtools-mark--window{border-width:2px;border-style:solid}.wf-devtools-mark--drop-zone{border-color:var(--wf-color-accent);border-width:2px}.wf-devtools-mark--selected{z-index:2;border-color:var(--wf-color-accent);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--wf-color-accent) 32%,transparent),0 0 0 1px var(--wf-color-accent)}.wf-devtools-mark span{position:absolute;top:var(--wf-devtools-label-top);left:var(--wf-devtools-label-left);max-width:min(320px,calc(100vw - 16px));padding:2px var(--wf-space-xs);background:var(--wf-color-surface-floating);color:var(--wf-color-text);font:var(--wf-font-size-xs)/1.2 var(--wf-font-family);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1px solid var(--wf-color-border-floating);border-radius:var(--wf-radius-sm)}.wf-devtools{position:fixed;right:var(--wf-space-md);bottom:var(--wf-space-md);z-index:calc(var(--wf-layer-overlay) + 30);width:min(440px,calc(100vw - 24px));max-height:min(72vh,720px);display:flex;flex-direction:column;border:1px solid var(--wf-color-border-overlay);border-radius:var(--wf-radius-md);background:var(--wf-color-surface-overlay);box-shadow:var(--wf-shadow-lg);color:var(--wf-color-text);font:var(--wf-font-size-xs)/1.35 var(--wf-font-family)}.wf-devtools>header{display:flex;align-items:center;gap:var(--wf-space-sm);padding:var(--wf-space-sm) var(--wf-space-md);border-bottom:1px solid var(--wf-color-border-overlay)}.wf-devtools>header strong{flex:1}.wf-devtools button,.wf-devtools kbd,.wf-devtools select{border:1px solid var(--wf-color-border-floating);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface-floating);color:inherit;font:inherit}.wf-devtools button{cursor:pointer}.wf-devtools__controls{display:flex;flex-wrap:wrap;align-items:center;gap:var(--wf-space-sm);padding:var(--wf-space-sm) var(--wf-space-md)}.wf-devtools__controls label{display:flex;align-items:center;gap:var(--wf-space-xs)}.wf-devtools__inspect{cursor:pointer}.wf-devtools__filters{display:flex;flex-wrap:wrap;gap:var(--wf-space-sm);margin:0;padding:var(--wf-space-xs) var(--wf-space-md);border:0;border-top:1px solid var(--wf-color-border-overlay);border-bottom:1px solid var(--wf-color-border-overlay)}.wf-devtools__filters legend{width:100%;padding:0;color:var(--wf-color-text-muted)}.wf-devtools__filters label{display:flex;align-items:center;gap:var(--wf-space-xs)}.wf-devtools__summary{display:flex;flex-wrap:wrap;gap:var(--wf-space-sm);padding:var(--wf-space-xs) var(--wf-space-md);color:var(--wf-color-text-muted)}.wf-devtools__content{overflow:auto;padding:0 var(--wf-space-md) var(--wf-space-md)}.wf-devtools details{border-top:1px solid var(--wf-color-border-overlay);padding:var(--wf-space-xs) 0}.wf-devtools summary{cursor:pointer;font-weight:var(--wf-font-weight-semibold)}.wf-devtools ul{display:grid;gap:3px;margin:var(--wf-space-xs) 0;padding:0;list-style:none}.wf-devtools li{min-width:0}.wf-devtools__node{display:grid;width:100%;grid-template-columns:minmax(100px,1fr) auto;gap:2px var(--wf-space-sm);padding:var(--wf-space-xs);text-align:left}.wf-devtools__node--selected{background:var(--wf-color-selected);color:var(--wf-color-text)}.wf-devtools__node code{overflow:hidden;text-overflow:ellipsis}.wf-devtools__node small{grid-column:1/-1;color:var(--wf-color-text-muted)}.wf-devtools pre{max-height:260px;overflow:auto;margin:var(--wf-space-xs) 0 0;padding:var(--wf-space-sm);background:var(--wf-color-canvas);font:10px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;word-break:break-word}
</style>
