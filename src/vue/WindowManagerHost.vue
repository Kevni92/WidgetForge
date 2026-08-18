<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, toRaw } from 'vue'
import { createWidgetNavigator } from '../core/navigation'
import type { WidgetRegistry } from '../core/widget-registry'
import type { WindowGeometry, WindowPosition, WindowSize } from '../core/window-geometry'
import type { WindowManager, WindowState } from '../core/window-manager'
import { detectWindowSnapZone, snapWindowGeometry, type WindowSnapZone } from '../core/window-snap'
import { observeElementSize } from './observe-element-size'
import { provideWidgetNavigation } from './widget-navigation'
import WindowFrame from './WindowFrame.vue'

interface WindowManagerHostProps {
  manager: WindowManager
  registry: WidgetRegistry
}

interface SnapPreviewState {
  readonly instanceId: string
  readonly zone: WindowSnapZone
  readonly geometry: WindowGeometry
}

const props = defineProps<WindowManagerHostProps>()
const manager = toRaw(props.manager)
const registry = toRaw(props.registry)
const navigator = createWidgetNavigator(registry, manager)
provideWidgetNavigation(navigator)

const hostElement = ref<HTMLElement | null>(null)
const containerSize = shallowRef<WindowSize>({ width: 0, height: 0 })
const windows = shallowRef<readonly WindowState[]>(manager.list())
const snapPreview = shallowRef<SnapPreviewState | null>(null)
let disposeSizeObserver: (() => void) | null = null

const unsubscribe = manager.subscribe((change) => {
  windows.value = change.windows
  if (change.kind === 'close' && snapPreview.value?.instanceId === change.instanceId) snapPreview.value = null
  if (change.kind === 'open' && containerSize.value.width > 0 && containerSize.value.height > 0) {
    manager.constrainToContainer(change.instanceId, containerSize.value)
  }
})

function localPoint(clientX: number, clientY: number): WindowPosition | null {
  const host = hostElement.value
  if (!host) return null
  const rect = host.getBoundingClientRect()
  return { x: clientX - rect.left, y: clientY - rect.top }
}

function resolveSnapZone(clientX: number, clientY: number): WindowSnapZone | null {
  const point = localPoint(clientX, clientY)
  return point ? detectWindowSnapZone(point, containerSize.value) : null
}

function previewSnap(instanceId: string, zone: WindowSnapZone | null): void {
  if (!zone) {
    if (snapPreview.value?.instanceId === instanceId) snapPreview.value = null
    return
  }
  snapPreview.value = { instanceId, zone, geometry: snapWindowGeometry(zone, containerSize.value) }
}

function commitSnap(instanceId: string, zone: WindowSnapZone): void {
  snapPreview.value = null
  manager.snapWindow(instanceId, zone, containerSize.value, 'user')
}

function unsnapForPointer(instanceId: string, clientX: number, clientY: number): WindowState {
  const point = localPoint(clientX, clientY)
  return point
    ? manager.unsnapWindow(instanceId, point, containerSize.value, 'user')
    : manager.unsnapWindow(instanceId, undefined, undefined, 'user')
}

function previewStyle(geometry: WindowGeometry): Record<string, string> {
  return {
    left: `${geometry.position.x}px`,
    top: `${geometry.position.y}px`,
    width: `${geometry.size.width}px`,
    height: `${geometry.size.height}px`,
  }
}

onMounted(() => {
  if (!hostElement.value) return

  disposeSizeObserver = observeElementSize(hostElement.value, (size) => {
    containerSize.value = size
    if (snapPreview.value) {
      snapPreview.value = {
        ...snapPreview.value,
        geometry: snapWindowGeometry(snapPreview.value.zone, size),
      }
    }
    for (const window of manager.list()) manager.constrainToContainer(window.instanceId, size)
  })
})

onBeforeUnmount(() => {
  snapPreview.value = null
  disposeSizeObserver?.()
  disposeSizeObserver = null
  unsubscribe()
})
</script>

<template>
  <div ref="hostElement" class="wf-window-manager-host">
    <div
      v-if="snapPreview"
      class="wf-window-snap-preview"
      :data-window-snap-preview="snapPreview.instanceId"
      :data-window-snap-zone="snapPreview.zone"
      :style="previewStyle(snapPreview.geometry)"
      aria-hidden="true"
    />
    <WindowFrame
      v-for="window in windows"
      :key="window.instanceId"
      :window="window"
      :manager="manager"
      :registry="registry"
      :container-size="containerSize"
      :lifecycle="manager.getLifecycle(window.instanceId)"
      :resolve-snap-zone="resolveSnapZone"
      :preview-snap="previewSnap"
      :commit-snap="commitSnap"
      :unsnap-for-pointer="unsnapForPointer"
    />
  </div>
</template>

<style scoped>
.wf-window-manager-host {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.wf-window-snap-preview {
  position: absolute;
  z-index: var(--wf-layer-overlay);
  pointer-events: none;
  border: 1px solid var(--wf-color-focus);
  border-radius: var(--wf-radius-sm);
  background: var(--wf-color-selected);
  box-shadow: inset 0 0 0 1px var(--wf-color-border);
}
</style>
