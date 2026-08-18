<script setup lang="ts">
import { markRaw } from 'vue'
import {
  WorkspaceHost,
  createDockManager,
  createSplitPane,
  createWidgetPane,
  createWindowManager,
} from 'widgetforge'
import { playgroundWidgetRegistry } from './playground-widgets'

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
      createWidgetPane({
        id: 'demo-top-left',
        widgetId: 'planet.summary',
        instanceId: 'demo-top-left-widget',
        parameters: { planetId: 'DOCK-A', compact: true },
        settings: { background: 'surface' },
      }),
      createWidgetPane({
        id: 'demo-top-right',
        widgetId: 'planet.summary',
        instanceId: 'demo-top-right-widget',
        parameters: { planetId: 'DOCK-B', compact: true },
        settings: { background: 'surface-raised' },
      }),
    ],
  }),
})

docks.add({
  id: 'demo-bottom',
  position: 'bottom',
  thickness: 96,
  minThickness: 64,
  maxThickness: 160,
  pane: createWidgetPane({
    id: 'demo-bottom-pane',
    widgetId: 'market.ticker',
    instanceId: 'demo-bottom-widget',
    parameters: { commodity: 'DOCK', rows: 2 },
    settings: { background: 'canvas' },
  }),
})

windows.open({
  widgetId: 'planet.summary',
  instanceId: 'dock-demo-floating',
  parameters: { planetId: 'FLOAT-01', compact: true },
  position: { x: 48, y: 36 },
  size: { width: 360, height: 230 },
})
</script>

<template>
  <div class="workspace-dock-showcase" data-workspace-dock-showcase>
    <WorkspaceHost :windows="windows" :docks="docks" :registry="playgroundWidgetRegistry" />
  </div>
</template>

<style scoped>
.workspace-dock-showcase {
  height: 520px;
  overflow: hidden;
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-md);
  box-shadow: inset var(--wf-shadow-sm);
}
</style>
