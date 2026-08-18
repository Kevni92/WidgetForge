<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, toRaw } from 'vue'
import { createWidgetNavigator } from '../core/navigation'
import type { WidgetRegistry } from '../core/widget-registry'
import type { WindowGeometry, WindowPosition, WindowSize } from '../core/window-geometry'
import type { WindowManager, WindowState } from '../core/window-manager'
import { detectWindowSnapZone, snapWindowGeometry, type WindowSnapZone } from '../core/window-snap'
import {
  detectWorkspaceDropZone,
  dockWindowIntoWindow,
  workspaceDropPreviewRect,
  type WorkspaceDropRect,
} from '../core/workspace-docking'
import { observeElementSize } from './observe-element-size'
import { provideWidgetNavigation } from './widget-navigation'
import WindowFrame, { type WindowDropTarget } from './WindowFrame.vue'

interface WindowManagerHostProps { manager: WindowManager; registry: WidgetRegistry }
interface SnapPreviewState { readonly instanceId: string; readonly zone: WindowSnapZone; readonly geometry: WindowGeometry }
interface WindowDockPreviewState { readonly sourceInstanceId: string; readonly target: WindowDropTarget; readonly rect: WorkspaceDropRect }

const props = defineProps<WindowManagerHostProps>()
const manager = toRaw(props.manager)
const registry = toRaw(props.registry)
const navigator = createWidgetNavigator(registry, manager)
provideWidgetNavigation(navigator)
const hostElement = ref<HTMLElement | null>(null)
const containerSize = shallowRef<WindowSize>({ width: 0, height: 0 })
const windows = shallowRef<readonly WindowState[]>(manager.list())
const snapPreview = shallowRef<SnapPreviewState | null>(null)
const windowDockPreview = shallowRef<WindowDockPreviewState | null>(null)
let disposeSizeObserver: (() => void) | null = null
let windowDockSequence = 0

const unsubscribe = manager.subscribe((change) => {
  windows.value = change.windows
  if (change.kind === 'close') {
    if (snapPreview.value?.instanceId === change.instanceId) snapPreview.value = null
    if (windowDockPreview.value?.sourceInstanceId === change.instanceId || windowDockPreview.value?.target.targetInstanceId === change.instanceId) windowDockPreview.value = null
  }
  if (change.kind === 'open' && containerSize.value.width > 0 && containerSize.value.height > 0) manager.constrainToContainer(change.instanceId, containerSize.value)
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
  if (!zone) { if (snapPreview.value?.instanceId === instanceId) snapPreview.value = null; return }
  snapPreview.value = { instanceId, zone, geometry: snapWindowGeometry(zone, containerSize.value) }
}
function commitSnap(instanceId: string, zone: WindowSnapZone): void { snapPreview.value = null; manager.snapWindow(instanceId, zone, containerSize.value, 'user') }
function unsnapForPointer(instanceId: string, clientX: number, clientY: number): WindowState {
  const point = localPoint(clientX, clientY)
  return point ? manager.unsnapWindow(instanceId, point, containerSize.value, 'user') : manager.unsnapWindow(instanceId, undefined, undefined, 'user')
}
function containsClientPoint(rect: DOMRect, clientX: number, clientY: number): boolean {
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom && rect.width > 0 && rect.height > 0
}
function targetWindowElement(sourceInstanceId: string, clientX: number, clientY: number): HTMLElement | null {
  const host = hostElement.value
  if (!host) return null
  return [...host.querySelectorAll<HTMLElement>('.wf-window-frame[data-window-instance-id]')]
    .filter((element) => element.dataset.windowInstanceId !== sourceInstanceId && element.dataset.windowMode === 'normal')
    .filter((element) => containsClientPoint(element.getBoundingClientRect(), clientX, clientY))
    .sort((left, right) => Number(right.dataset.windowZIndex ?? 0) - Number(left.dataset.windowZIndex ?? 0))[0] ?? null
}
function targetPaneElement(windowElement: HTMLElement, clientX: number, clientY: number): HTMLElement | null {
  return [...windowElement.querySelectorAll<HTMLElement>('.wf-pane-host[data-pane-id]')]
    .filter((element) => containsClientPoint(element.getBoundingClientRect(), clientX, clientY))
    .sort((left, right) => {
      const a = left.getBoundingClientRect(); const b = right.getBoundingClientRect()
      return a.width * a.height - b.width * b.height
    })[0] ?? null
}
function findWindowElement(instanceId: string): HTMLElement | null {
  const host = hostElement.value
  if (!host) return null
  return [...host.querySelectorAll<HTMLElement>('.wf-window-frame[data-window-instance-id]')].find((element) => element.dataset.windowInstanceId === instanceId) ?? null
}
function findPaneElement(windowElement: HTMLElement, paneId: string): HTMLElement | null {
  return [...windowElement.querySelectorAll<HTMLElement>('.wf-pane-host[data-pane-id]')].find((element) => element.dataset.paneId === paneId) ?? null
}
function resolveWindowDrop(sourceInstanceId: string, clientX: number, clientY: number): WindowDropTarget | null {
  const windowElement = targetWindowElement(sourceInstanceId, clientX, clientY)
  if (!windowElement) return null
  const paneElement = targetPaneElement(windowElement, clientX, clientY)
  const targetInstanceId = windowElement.dataset.windowInstanceId
  const targetPaneId = paneElement?.dataset.paneId
  if (!paneElement || !targetInstanceId || !targetPaneId) return null
  const rect = paneElement.getBoundingClientRect()
  const zone = detectWorkspaceDropZone({ x: clientX, y: clientY }, { x: rect.left, y: rect.top, width: rect.width, height: rect.height })
  if (!zone || (zone === 'center' && paneElement.dataset.paneKind === 'split')) return null
  return { targetInstanceId, targetPaneId, zone }
}
function previewWindowDrop(sourceInstanceId: string, target: WindowDropTarget | null): void {
  if (!target) { if (windowDockPreview.value?.sourceInstanceId === sourceInstanceId) windowDockPreview.value = null; return }
  const host = hostElement.value
  const targetWindow = findWindowElement(target.targetInstanceId)
  const paneElement = targetWindow ? findPaneElement(targetWindow, target.targetPaneId) : null
  if (!host || !paneElement) return
  const hostRect = host.getBoundingClientRect(); const paneRect = paneElement.getBoundingClientRect()
  const preview = workspaceDropPreviewRect(target.zone, { x: paneRect.left, y: paneRect.top, width: paneRect.width, height: paneRect.height })
  windowDockPreview.value = { sourceInstanceId, target, rect: { x: preview.x - hostRect.left, y: preview.y - hostRect.top, width: preview.width, height: preview.height } }
}
function commitWindowDrop(sourceInstanceId: string, target: WindowDropTarget): void {
  windowDockPreview.value = null; windowDockSequence += 1
  dockWindowIntoWindow(manager, sourceInstanceId, target.targetInstanceId, target.targetPaneId, target.zone, `window-dock-${windowDockSequence}`)
}
function geometryStyle(geometry: WindowGeometry): Record<string, string> { return { left: `${geometry.position.x}px`, top: `${geometry.position.y}px`, width: `${geometry.size.width}px`, height: `${geometry.size.height}px` } }
function rectStyle(rect: WorkspaceDropRect): Record<string, string> { return { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` } }

onMounted(() => {
  if (!hostElement.value) return
  disposeSizeObserver = observeElementSize(hostElement.value, (size) => {
    containerSize.value = size
    if (snapPreview.value) snapPreview.value = { ...snapPreview.value, geometry: snapWindowGeometry(snapPreview.value.zone, size) }
    for (const window of manager.list()) manager.constrainToContainer(window.instanceId, size)
  })
})
onBeforeUnmount(() => { snapPreview.value = null; windowDockPreview.value = null; disposeSizeObserver?.(); disposeSizeObserver = null; unsubscribe() })
</script>

<template>
  <div ref="hostElement" class="wf-window-manager-host">
    <div v-if="snapPreview" class="wf-window-snap-preview" :data-window-snap-preview="snapPreview.instanceId" :data-window-snap-zone="snapPreview.zone" :style="geometryStyle(snapPreview.geometry)" aria-hidden="true" />
    <div v-if="windowDockPreview" class="wf-window-dock-preview" :data-window-dock-preview="windowDockPreview.sourceInstanceId" :data-window-dock-target="windowDockPreview.target.targetInstanceId" :data-window-dock-zone="windowDockPreview.target.zone" :style="rectStyle(windowDockPreview.rect)" aria-hidden="true" />
    <WindowFrame v-for="window in windows" :key="window.instanceId" :window="window" :manager="manager" :registry="registry" :container-size="containerSize" :lifecycle="manager.getLifecycle(window.instanceId)" :resolve-snap-zone="resolveSnapZone" :preview-snap="previewSnap" :commit-snap="commitSnap" :unsnap-for-pointer="unsnapForPointer" :resolve-window-drop="resolveWindowDrop" :preview-window-drop="previewWindowDrop" :commit-window-drop="commitWindowDrop" />
  </div>
</template>

<style scoped>
.wf-window-manager-host{position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden}
.wf-window-snap-preview,.wf-window-dock-preview{position:absolute;z-index:var(--wf-layer-overlay);pointer-events:none;border:1px solid var(--wf-color-focus);border-radius:var(--wf-radius-sm);background:var(--wf-color-selected);box-shadow:inset 0 0 0 1px var(--wf-color-border)}
.wf-window-dock-preview{outline:1px dashed var(--wf-color-accent);outline-offset:-3px}
</style>
