<script setup lang="ts">
import { markRaw, onBeforeUnmount, shallowRef } from 'vue'
import { WorkspaceHost, createDockManager, createWidgetPane, createWorkspaceEditController, createWorkspaceHistory, createWindowManager, restoreWorkspace, serializeWorkspace } from 'widgetforge'
import { playgroundWidgetRegistry } from './playground-widgets'

const STORAGE_KEY = 'widgetforge.playground.layout-acceptance.v1'
const windows = markRaw(createWindowManager(playgroundWidgetRegistry))
const docks = markRaw(createDockManager(playgroundWidgetRegistry))
const edit = markRaw(createWorkspaceEditController())

function seedWorkspace(): void {
  docks.add({ id: 'topnav', position: 'top', thickness: 54, minThickness: 48, maxThickness: 72, resizable: true, pane: createWidgetPane({ id: 'topnav-pane', widgetId: 'demo.live-metric', parameters: { resourceId: 'grid-power' } }) })
  const rightX = Math.max(530, window.innerWidth - 198)
  const centerWidth = Math.min(620, Math.max(260, rightX - 210))
  windows.open({
    widgetId: 'demo.layout-acceptance',
    instanceId: 'left-menu',
    title: 'Left Menu',
    parameters: { region: 'left', description: 'Persistent navigation surface at the left workspace edge.' },
    position: { x: 18, y: 140 },
    size: { width: 160, height: 390 },
    layoutSpec: { horizontal: { start: { target: { kind: 'workspace', edge: 'left' } }, size: { value: 160, unit: 'px' } }, vertical: { start: { target: { kind: 'workspace', edge: 'top' }, offset: { value: 140, unit: 'px' } }, size: { value: 390, unit: 'px' } } },
    layoutSpecState: 'active',
  })
  windows.open({
    widgetId: 'demo.layout-acceptance',
    instanceId: 'center-window',
    title: 'Center Canvas',
    parameters: { region: 'center', description: 'A free canvas window that can follow another layout surface.' },
    position: { x: 194, y: 140 },
    size: { width: centerWidth, height: 390 },
  })
  windows.open({
    widgetId: 'demo.layout-acceptance',
    instanceId: 'right-menu',
    title: 'Right Menu',
    parameters: { region: 'right', description: 'Persistent navigation surface at the right workspace edge.' },
    position: { x: rightX, y: 140 },
    size: { width: 180, height: 390 },
    layoutSpec: { horizontal: { end: { target: { kind: 'workspace', edge: 'right' } }, size: { value: 180, unit: 'px' } }, vertical: { start: { target: { kind: 'workspace', edge: 'top' }, offset: { value: 140, unit: 'px' } }, size: { value: 390, unit: 'px' } } },
    layoutSpecState: 'active',
  })
}

function lockStaticMenuWindows(): void {
  for (const instanceId of ['left-menu', 'right-menu']) {
    const window = windows.list().find((candidate) => candidate.instanceId === instanceId)
    if (window && !window.layoutLocked) windows.lockWindow(instanceId, 'api')
  }
}

function restoreOrSeed(): void {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const restored = restoreWorkspace(windows, stored, docks, undefined, { atomic: true })
      if (restored.valid && restored.issues.length === 0 && windows.list().length > 0) {
        lockStaticMenuWindows()
        return
      }
    }
  } catch {
    // A clean fixture is the safe fallback when persisted data is stale.
  }
  seedWorkspace()
  lockStaticMenuWindows()
}

restoreOrSeed()
const history = markRaw(createWorkspaceHistory(windows, docks, { limit: 50 }))
const historyState = shallowRef(history.state)
let persistQueued = false
function persist(): void {
  if (persistQueued) return
  persistQueued = true
  queueMicrotask(() => {
    persistQueued = false
    try { window.localStorage.setItem(STORAGE_KEY, serializeWorkspace(windows, docks)) } catch { /* best effort */ }
  })
}
const unsubscribeWindows = windows.subscribe(persist)
const unsubscribeDocks = docks.subscribe(persist)
const unsubscribeHistory = history.subscribe((state) => { historyState.value = state })
function undo(): void { history.undo(); persist() }
function redo(): void { history.redo(); persist() }
persist()

let newWindowSequence = 0
function openNewWindow(): void {
  newWindowSequence += 1
  const instanceId = `acceptance-window-${newWindowSequence}`
  windows.open({
    widgetId: 'demo.layout-acceptance',
    instanceId,
    title: 'New Canvas Window',
    parameters: { region: 'center', description: 'A newly opened consumer window.' },
    position: { x: 250 + newWindowSequence * 12, y: 120 + newWindowSequence * 12 },
    size: { width: 280, height: 240 },
  }, 'user')
}

onBeforeUnmount(() => {
  unsubscribeWindows()
  unsubscribeDocks()
  unsubscribeHistory()
  history.dispose()
})
</script>

<template>
  <div class="layout-acceptance" data-layout-acceptance-fixture>
    <header class="layout-acceptance__toolbar" data-layout-acceptance-toolbar>
      <div>
        <strong>Layout editor acceptance workspace</strong>
        <span>Left Menu · Center Canvas · Right Menu</span>
      </div>
      <nav aria-label="Acceptance workspace history and window actions">
        <button type="button" data-layout-acceptance-undo :disabled="!historyState.canUndo" @click="undo">Undo</button>
        <button type="button" data-layout-acceptance-redo :disabled="!historyState.canRedo" @click="redo">Redo</button>
        <button type="button" data-layout-acceptance-new-window @click="openNewWindow">New window</button>
      </nav>
    </header>
    <div class="layout-acceptance__workspace">
      <WorkspaceHost :windows="windows" :docks="docks" :registry="playgroundWidgetRegistry" :history="history" :edit="edit" />
    </div>
  </div>
</template>

<style scoped>
.layout-acceptance{display:flex;width:100%;height:100%;min-width:0;min-height:0;flex-direction:column;background:var(--wf-color-canvas)}
.layout-acceptance__toolbar{display:flex;min-height:58px;align-items:center;justify-content:space-between;gap:var(--wf-space-md);padding:var(--wf-space-sm) var(--wf-space-md);border-bottom:1px solid var(--wf-color-border);background:var(--wf-color-surface);color:var(--wf-color-text)}
.layout-acceptance__toolbar div{display:grid;gap:var(--wf-space-2xs);min-width:0}
.layout-acceptance__toolbar span{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs)}
.layout-acceptance__toolbar nav{display:flex;flex-wrap:wrap;gap:var(--wf-space-xs);justify-content:flex-end}
.layout-acceptance__toolbar button{min-height:var(--wf-size-control-height);padding:0 var(--wf-space-sm);border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface-floating);color:var(--wf-color-text);font:inherit;font-size:var(--wf-font-size-xs);cursor:pointer}
.layout-acceptance__toolbar button:hover:not(:disabled),.layout-acceptance__toolbar button:focus-visible{border-color:var(--wf-color-focus);background:var(--wf-color-selected)}
.layout-acceptance__toolbar button:disabled{cursor:default;opacity:.55}
.layout-acceptance__toolbar button:focus-visible{outline:2px solid var(--wf-color-focus);outline-offset:2px}
.layout-acceptance__workspace{position:relative;flex:1 1 auto;min-width:0;min-height:0;overflow:hidden}
</style>
