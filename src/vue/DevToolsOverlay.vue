<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue'
import { captureWidgetForgeDevToolsSnapshot, type WidgetForgeDevToolsSnapshot } from '../core/devtools'
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

interface VisualMark {
  readonly key: string
  readonly kind: 'pane' | 'window' | 'drop-zone'
  readonly label: string
  readonly style: Readonly<Record<string, string>>
}

const open = shallowRef(false)
const snapshot = shallowRef<WidgetForgeDevToolsSnapshot>(captureWidgetForgeDevToolsSnapshot(props.windows, props.docks, props.dataClient))
const marks = shallowRef<readonly VisualMark[]>([])
let disposers: Array<() => void> = []
let observer: MutationObserver | null = null

const workspaceJson = computed(() => JSON.stringify(snapshot.value.workspace, null, 2))

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
function root(): ParentNode { return props.target ?? document }
function markStyle(rect: DOMRect): Record<string, string> {
  return { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` }
}
function refreshMarks(): void {
  if (!props.enabled || !open.value) { marks.value = []; return }
  const next: VisualMark[] = []
  for (const element of root().querySelectorAll<HTMLElement>('[data-window-instance-id]')) {
    const rect = element.getBoundingClientRect()
    next.push({ key: `window:${element.dataset.windowInstanceId}`, kind: 'window', label: `${element.dataset.windowInstanceId ?? 'window'} · z${element.dataset.windowZIndex ?? '?'} · ${element.dataset.windowLayer ?? 'normal'}`, style: markStyle(rect) })
  }
  for (const element of root().querySelectorAll<HTMLElement>('[data-pane-id]')) {
    const rect = element.getBoundingClientRect()
    const focused = element.dataset.paneFocused === 'true' ? ' · focused' : ''
    next.push({ key: `pane:${element.dataset.paneId}:${next.length}`, kind: 'pane', label: `${element.dataset.paneId ?? 'pane'} · ${element.dataset.paneKind ?? '?'} · ${Math.round(rect.width)}×${Math.round(rect.height)}${focused}`, style: markStyle(rect) })
  }
  for (const element of root().querySelectorAll<HTMLElement>('[data-docking-active-zone]')) {
    const rect = element.getBoundingClientRect()
    next.push({ key: `drop:${element.dataset.dockingSource ?? ''}:${element.dataset.dockingTarget ?? ''}`, kind: 'drop-zone', label: `drop · ${element.dataset.dockingActiveZone ?? '?'}`, style: markStyle(rect) })
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
  observer.observe(observed, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-pane-focused', 'data-pane-active', 'data-window-z-index', 'data-window-layer', 'data-docking-active-zone'] })
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
  marks.value = []
  emit('close')
}
function toggle(): void { if (open.value) closeOverlay(); else openOverlay() }
function onKeydown(event: KeyboardEvent): void {
  if (!matchesShortcut(event)) return
  event.preventDefault()
  toggle()
}
function install(): void {
  cleanup()
  if (!props.enabled) return
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', refreshMarks)
  disposers = [
    props.windows.subscribe(refresh),
    ...(props.docks ? [props.docks.subscribe(refresh)] : []),
    ...(props.dataClient ? [props.dataClient.subscribeDiagnostics(refresh)] : []),
    () => window.removeEventListener('keydown', onKeydown),
    () => window.removeEventListener('resize', refreshMarks),
  ]
  refresh()
}
function cleanup(): void {
  stopObserver()
  for (const dispose of disposers.splice(0)) dispose()
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
watch(() => props.enabled, (enabled) => { if (!enabled) closeOverlay(); install() }, { immediate: true })
watch(() => [props.windows, props.docks, props.dataClient, props.target] as const, () => { install(); if (open.value) startObserver() })
onBeforeUnmount(cleanup)
defineExpose({ open: openOverlay, close: closeOverlay, toggle, refresh })
</script>

<template>
  <template v-if="enabled">
    <div v-if="open" class="wf-devtools-marks" aria-hidden="true" data-devtools-visual-overlay>
      <div v-for="mark in marks" :key="mark.key" class="wf-devtools-mark" :class="`wf-devtools-mark--${mark.kind}`" :style="mark.style"><span>{{ mark.label }}</span></div>
    </div>
    <aside v-if="open" class="wf-devtools" data-widgetforge-devtools aria-label="WidgetForge developer tools">
      <header><strong>WidgetForge DevTools</strong><kbd>{{ shortcut }}</kbd><button type="button" aria-label="Close DevTools" @click="closeOverlay">×</button></header>
      <div class="wf-devtools__summary"><span>{{ snapshot.windows.length }} windows</span><span>{{ snapshot.docks.length }} docks</span><span>{{ snapshot.panes.length }} panes</span><span>{{ snapshot.data?.totalConsumers ?? 0 }} data consumers</span></div>
      <div class="wf-devtools__content">
        <details open><summary>Windows</summary><ul><li v-for="window in snapshot.windows" :key="window.instanceId"><code>{{ window.instanceId }}</code><span>{{ window.mode }} · {{ window.layer }} · z{{ window.zIndex }}<template v-if="window.focused"> · focused</template></span><small>{{ window.geometry.position.x }},{{ window.geometry.position.y }} · {{ window.geometry.size.width }}×{{ window.geometry.size.height }}</small></li></ul></details>
        <details><summary>Docks</summary><ul><li v-for="dock in snapshot.docks" :key="dock.id"><code>{{ dock.id }}</code><span>{{ dock.position }} · {{ dock.thickness }}px</span><small>root {{ dock.rootPaneId }}</small></li></ul></details>
        <details><summary>Pane tree</summary><ul><li v-for="pane in snapshot.panes" :key="`${pane.ownerKind}:${pane.ownerId}:${pane.path.join('/')}`" :style="{paddingLeft:`${pane.depth*12}px`}"><code>{{ pane.id }}</code><span>{{ pane.kind }}<template v-if="pane.instanceId"> · {{ pane.instanceId }}</template></span><small>{{ pane.ownerKind }} {{ pane.ownerId }}</small></li></ul></details>
        <details><summary>DataClient</summary><ul><li v-for="resource in snapshot.data?.resources ?? []" :key="resource.keyId"><code>{{ resource.key.kind }}:{{ resource.key.id }}</code><span>{{ resource.status }} · {{ resource.consumers }} consumers</span><small>{{ resource.subscribed ? 'subscribed' : resource.cached ? 'cached' : 'inactive' }}</small></li></ul><p v-if="!snapshot.data?.resources.length">No cached resources</p></details>
        <details v-if="showWorkspaceJson"><summary>Workspace JSON</summary><button type="button" data-devtools-copy @click="copyWorkspaceJson">Copy JSON</button><pre>{{ workspaceJson }}</pre></details>
      </div>
    </aside>
  </template>
</template>

<style scoped>
.wf-devtools-marks{position:fixed;inset:0;z-index:calc(var(--wf-layer-overlay) + 20);pointer-events:none}.wf-devtools-mark{position:fixed;box-sizing:border-box;border:1px dashed var(--wf-color-focus);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--wf-color-focus) 24%,transparent)}.wf-devtools-mark--window{border-width:2px;border-style:solid}.wf-devtools-mark--drop-zone{border-color:var(--wf-color-warning);border-width:2px}.wf-devtools-mark span{position:absolute;top:0;left:0;max-width:100%;padding:2px 4px;background:var(--wf-color-surface-raised);color:var(--wf-color-text);font:10px/1.2 var(--wf-font-family);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wf-devtools{position:fixed;right:12px;bottom:12px;z-index:calc(var(--wf-layer-overlay) + 30);width:min(440px,calc(100vw - 24px));max-height:min(72vh,720px);display:flex;flex-direction:column;border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-md);background:var(--wf-color-surface);box-shadow:var(--wf-shadow-lg);color:var(--wf-color-text);font:var(--wf-font-size-xs)/1.35 var(--wf-font-family)}.wf-devtools>header{display:flex;align-items:center;gap:var(--wf-space-sm);padding:var(--wf-space-sm) var(--wf-space-md);border-bottom:1px solid var(--wf-color-border)}.wf-devtools>header strong{flex:1}.wf-devtools button,.wf-devtools kbd{border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface-raised);color:inherit;font:inherit}.wf-devtools button{cursor:pointer}.wf-devtools__summary{display:flex;flex-wrap:wrap;gap:var(--wf-space-sm);padding:var(--wf-space-xs) var(--wf-space-md);color:var(--wf-color-text-muted)}.wf-devtools__content{overflow:auto;padding:0 var(--wf-space-md) var(--wf-space-md)}.wf-devtools details{border-top:1px solid var(--wf-color-border);padding:var(--wf-space-xs) 0}.wf-devtools summary{cursor:pointer;font-weight:var(--wf-font-weight-semibold)}.wf-devtools ul{display:grid;gap:3px;margin:var(--wf-space-xs) 0;padding:0;list-style:none}.wf-devtools li{display:grid;grid-template-columns:minmax(100px,1fr) auto;gap:2px var(--wf-space-sm);min-width:0}.wf-devtools li code{overflow:hidden;text-overflow:ellipsis}.wf-devtools li small{grid-column:1/-1;color:var(--wf-color-text-muted)}.wf-devtools pre{max-height:260px;overflow:auto;margin:var(--wf-space-xs) 0 0;padding:var(--wf-space-sm);background:var(--wf-color-canvas);font:10px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;word-break:break-word}
</style>
