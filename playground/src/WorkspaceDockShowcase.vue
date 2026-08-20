<script setup lang="ts">
import { markRaw } from 'vue'
import {
  WorkspaceHost,
  createDockManager,
  createSelectionStore,
  createSplitPane,
  createWidgetPane,
  createWindowManager,
  provideSelectionStore,
  provideWidgetNavigation,
  type WidgetNavigator,
} from 'widgetforge'
import { playgroundWidgetRegistry } from './playground-widgets'

const props = defineProps<{ navigator: WidgetNavigator }>()
provideWidgetNavigation(props.navigator)
provideSelectionStore(markRaw(createSelectionStore()))

const docks = markRaw(createDockManager(playgroundWidgetRegistry))
const windows = markRaw(createWindowManager(playgroundWidgetRegistry))

docks.add({
  id: 'demo-top',
  position: 'top',
  thickness: 112,
  minThickness: 72,
  maxThickness: 180,
  pane: createSplitPane({
    id: 'demo-top-root',
    axis: 'horizontal',
    weights: [1, 1],
    children: [
      createWidgetPane({ id: 'demo-top-left', widgetId: 'planet.summary', instanceId: 'demo-top-left-widget', parameters: { planetId: 'DOCK-A', compact: true }, settings: { background: 'surface' } }),
      createWidgetPane({ id: 'demo-top-right', widgetId: 'planet.summary', instanceId: 'demo-top-right-widget', parameters: { planetId: 'DOCK-B', compact: true }, settings: { background: 'surface-raised' } }),
    ],
  }),
})

docks.add({
  id: 'demo-bottom',
  position: 'bottom',
  thickness: 96,
  minThickness: 64,
  maxThickness: 160,
  pane: createWidgetPane({ id: 'demo-bottom-pane', widgetId: 'market.ticker', instanceId: 'demo-bottom-widget', parameters: { commodity: 'DOCK', rows: 2 }, settings: { background: 'canvas' } }),
})

windows.open({ widgetId: 'planet.summary', instanceId: 'dock-demo-planet', parameters: { planetId: 'DRAG-01', compact: false }, position: { x: 24, y: 24 }, size: { width: 290, height: 230 } })
windows.open({ widgetId: 'market.ticker', instanceId: 'dock-demo-market', parameters: { commodity: 'METALS', rows: 5 }, position: { x: 360, y: 88 }, size: { width: 310, height: 250 } })
</script>

<template>
  <div class="workspace-dock-showcase" data-workspace-dock-showcase>
  <div class="workspace-dock-showcase__hint">Window titlebar: use the anchor action to move a floating window to any workspace edge. Normal: drag a tab grip to reorder tabs. Edit mode/Ctrl: rearrange panes or detach a dock back to a window.</div>
    <WorkspaceHost :windows="windows" :docks="docks" :registry="playgroundWidgetRegistry" />
  </div>
</template>

<style scoped>
.workspace-dock-showcase{position:relative;height:520px;overflow:hidden;border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-md);box-shadow:inset var(--wf-shadow-sm)}
.workspace-dock-showcase__hint{position:absolute;top:120px;left:50%;z-index:var(--wf-layer-overlay);transform:translateX(-50%);max-width:520px;padding:6px 10px;border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface-raised);color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs);pointer-events:none}
</style>
