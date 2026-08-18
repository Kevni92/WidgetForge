<script setup lang="ts">
import { onBeforeUnmount, ref, toRaw } from 'vue'
import type { PaneNode } from '../core/pane'
import type { WidgetLifecycleController } from '../core/widget-lifecycle'
import type { WidgetRegistry } from '../core/widget-registry'
import { moveWindow, resizeWindow, type ResizeHandle, type WindowGeometry, type WindowSize } from '../core/window-geometry'
import type { WindowManager, WindowState } from '../core/window-manager'
import type { WindowSnapZone } from '../core/window-snap'
import type { WorkspaceDropZone } from '../core/workspace-docking'
import WindowShell from './WindowShell.vue'

export interface WindowDropTarget {
  readonly targetInstanceId: string
  readonly targetPaneId: string
  readonly zone: WorkspaceDropZone
}

interface WindowFrameProps {
  window: WindowState
  manager: WindowManager
  registry: WidgetRegistry
  containerSize: WindowSize
  lifecycle?: WidgetLifecycleController
  resolveSnapZone?: (clientX: number, clientY: number) => WindowSnapZone | null
  previewSnap?: (instanceId: string, zone: WindowSnapZone | null) => void
  commitSnap?: (instanceId: string, zone: WindowSnapZone) => void
  unsnapForPointer?: (instanceId: string, clientX: number, clientY: number) => WindowState
  resolveWindowDrop?: (sourceInstanceId: string, clientX: number, clientY: number) => WindowDropTarget | null
  previewWindowDrop?: (sourceInstanceId: string, target: WindowDropTarget | null) => void
  commitWindowDrop?: (sourceInstanceId: string, target: WindowDropTarget) => void
}

interface InteractionSession {
  pointerId: number | undefined
  captureTarget: HTMLElement
  startX: number
  startY: number
  startGeometry: WindowGeometry
  handle: ResizeHandle | null
  unsnapPending: boolean
  snapZone: WindowSnapZone | null
  windowDrop: WindowDropTarget | null
}

const props = defineProps<WindowFrameProps>()
const manager = toRaw(props.manager)
const lifecycleController = props.lifecycle ?? manager.getLifecycle(props.window.instanceId)
const interactionKind = ref<'move' | 'resize' | null>(null)
let disposeInteraction: (() => void) | null = null
const resizeHandles: readonly ResizeHandle[] = ['top','bottom','left','right','top-left','top-right','bottom-left','bottom-right']

function effectiveContainerSize(): WindowSize {
  if (props.containerSize.width > 0 && props.containerSize.height > 0) return props.containerSize
  return { width: 1_000_000, height: 1_000_000 }
}

function frameStyle(): Record<string, string> {
  const { geometry, zIndex, mode, options } = props.window
  return {
    left: `${geometry.position.x}px`, top: `${geometry.position.y}px`, width: `${geometry.size.width}px`,
    height: mode === 'minimized' ? 'var(--wf-size-titlebar-height)' : `${geometry.size.height}px`,
    zIndex: `calc(var(--wf-layer-window) + ${zIndex})`, opacity: String(options.opacity),
  }
}

function finishInteraction(): void { disposeInteraction?.() }

function startInteraction(event: PointerEvent): void {
  if (props.window.mode === 'minimized') return
  const target = event.target
  if (!(target instanceof HTMLElement) || target.closest('button, input, select, textarea, a')) return
  const resizeElement = target.closest<HTMLElement>('[data-window-resize-handle]')
  const dragElement = target.closest<HTMLElement>('[data-window-drag-handle]')
  if (!resizeElement && !dragElement) return
  if (resizeElement && !props.window.options.resizable) return
  if (dragElement && !resizeElement && !props.window.options.movable) return
  const handle = resizeElement?.dataset.windowResizeHandle as ResizeHandle | undefined
  if (resizeElement && !handle) return

  event.preventDefault(); finishInteraction(); manager.focus(props.window.instanceId, 'user')
  const session: InteractionSession = {
    pointerId: typeof event.pointerId === 'number' ? event.pointerId : undefined,
    captureTarget: target,
    startX: event.clientX,
    startY: event.clientY,
    startGeometry: { position: { ...props.window.geometry.position }, size: { ...props.window.geometry.size } },
    handle: handle ?? null,
    unsnapPending: !handle && props.window.snap !== null,
    snapZone: null,
    windowDrop: null,
  }
  interactionKind.value = session.handle ? 'resize' : 'move'
  if (session.pointerId !== undefined && typeof session.captureTarget.setPointerCapture === 'function') {
    try { session.captureTarget.setPointerCapture(session.pointerId) } catch { /* Pointer capture is optional. */ }
  }

  const pointerMatches = (pointerEvent: PointerEvent): boolean => session.pointerId === undefined || typeof pointerEvent.pointerId !== 'number' || pointerEvent.pointerId === session.pointerId
  const updatePreviews = (pointerEvent: PointerEvent): void => {
    if (session.handle) return
    session.windowDrop = props.resolveWindowDrop?.(props.window.instanceId, pointerEvent.clientX, pointerEvent.clientY) ?? null
    props.previewWindowDrop?.(props.window.instanceId, session.windowDrop)
    if (session.windowDrop) {
      session.snapZone = null
      props.previewSnap?.(props.window.instanceId, null)
      return
    }
    session.snapZone = props.resolveSnapZone?.(pointerEvent.clientX, pointerEvent.clientY) ?? null
    props.previewSnap?.(props.window.instanceId, session.snapZone)
  }
  const onPointerMove = (pointerEvent: PointerEvent): void => {
    if (!pointerMatches(pointerEvent)) return

    if (!session.handle && session.unsnapPending) {
      const unsnapped = props.unsnapForPointer?.(props.window.instanceId, pointerEvent.clientX, pointerEvent.clientY)
      if (unsnapped) {
        session.startGeometry = { position: { ...unsnapped.geometry.position }, size: { ...unsnapped.geometry.size } }
        session.startX = pointerEvent.clientX
        session.startY = pointerEvent.clientY
      }
      session.unsnapPending = false
    }

    const delta = { x: pointerEvent.clientX - session.startX, y: pointerEvent.clientY - session.startY }
    const geometry = session.handle
      ? resizeWindow(session.startGeometry, session.handle, delta, props.window.constraints, effectiveContainerSize())
      : moveWindow(session.startGeometry, delta, effectiveContainerSize())
    manager.setGeometry(props.window.instanceId, geometry, 'user')
    updatePreviews(pointerEvent)
  }
  const cleanup = (): void => {
    globalThis.window.removeEventListener('pointermove', onPointerMove)
    globalThis.window.removeEventListener('pointerup', onPointerEnd)
    globalThis.window.removeEventListener('pointercancel', onPointerEnd)
    if (!session.handle) {
      props.previewSnap?.(props.window.instanceId, null)
      props.previewWindowDrop?.(props.window.instanceId, null)
    }
    if (session.pointerId !== undefined && typeof session.captureTarget.releasePointerCapture === 'function') {
      try { session.captureTarget.releasePointerCapture(session.pointerId) } catch { /* Browser may already have released capture. */ }
    }
    if (disposeInteraction === cleanup) disposeInteraction = null
    interactionKind.value = null
  }
  const onPointerEnd = (pointerEvent: PointerEvent): void => {
    if (!pointerMatches(pointerEvent)) return
    if (pointerEvent.type === 'pointerup' && !session.handle) {
      if (session.windowDrop) props.commitWindowDrop?.(props.window.instanceId, session.windowDrop)
      else if (session.snapZone) props.commitSnap?.(props.window.instanceId, session.snapZone)
    }
    cleanup()
  }

  disposeInteraction = cleanup
  globalThis.window.addEventListener('pointermove', onPointerMove)
  globalThis.window.addEventListener('pointerup', onPointerEnd)
  globalThis.window.addEventListener('pointercancel', onPointerEnd)
}

function focusWindow(): void { manager.focus(props.window.instanceId, 'user') }
function closeWindow(): void { finishInteraction(); manager.close(props.window.instanceId, 'user') }
function minimizeWindow(): void { finishInteraction(); manager.minimize(props.window.instanceId, 'user') }
function restoreWindow(): void { manager.restore(props.window.instanceId, 'user') }
function updateRootPane(pane: PaneNode): void { manager.setRootPane(props.window.instanceId, pane, 'user') }
onBeforeUnmount(finishInteraction)
</script>

<template>
  <div class="wf-window-frame" :class="{ 'wf-window-frame--interacting': interactionKind, 'wf-window-frame--minimized': window.mode === 'minimized' }"
    :data-window-instance-id="window.instanceId" :data-window-z-index="window.zIndex" :data-window-layer="window.options.layer" :data-window-mode="window.mode" :data-window-interaction="interactionKind ?? 'none'" :style="frameStyle()" @pointerdown.capture="startInteraction">
    <WindowShell :registry="registry" :pane="window.rootPane" :instance-id="window.instanceId" :title="window.title" :focused="window.focused"
      :minimized="window.mode === 'minimized'" :closable="window.options.closable" :minimizable="window.options.minimizable" :movable="window.options.movable" :header="window.options.header" :lifecycle="lifecycleController"
      @focus="focusWindow" @close="closeWindow" @minimize="minimizeWindow" @restore="restoreWindow" @update:pane="updateRootPane" />
    <template v-if="window.mode === 'normal' && window.options.resizable">
      <div v-for="handle in resizeHandles" :key="handle" class="wf-window-frame__resize-handle" :class="`wf-window-frame__resize-handle--${handle}`" :data-window-resize-handle="handle" aria-hidden="true" />
    </template>
  </div>
</template>

<style scoped>
.wf-window-frame{position:absolute;min-width:0;min-height:0;touch-action:none}.wf-window-frame :deep(.wf-window-shell){width:100%;height:100%}.wf-window-frame :deep([data-window-drag-handle]){cursor:move}.wf-window-frame--minimized :deep([data-window-drag-handle]){cursor:default}.wf-window-frame__resize-handle{position:absolute;z-index:2;touch-action:none}.wf-window-frame__resize-handle--top,.wf-window-frame__resize-handle--bottom{right:8px;left:8px;height:8px;cursor:ns-resize}.wf-window-frame__resize-handle--top{top:-4px}.wf-window-frame__resize-handle--bottom{bottom:-4px}.wf-window-frame__resize-handle--left,.wf-window-frame__resize-handle--right{top:8px;bottom:8px;width:8px;cursor:ew-resize}.wf-window-frame__resize-handle--left{left:-4px}.wf-window-frame__resize-handle--right{right:-4px}.wf-window-frame__resize-handle--top-left,.wf-window-frame__resize-handle--top-right,.wf-window-frame__resize-handle--bottom-left,.wf-window-frame__resize-handle--bottom-right{width:12px;height:12px}.wf-window-frame__resize-handle--top-left{top:-5px;left:-5px;cursor:nwse-resize}.wf-window-frame__resize-handle--top-right{top:-5px;right:-5px;cursor:nesw-resize}.wf-window-frame__resize-handle--bottom-left{bottom:-5px;left:-5px;cursor:nesw-resize}.wf-window-frame__resize-handle--bottom-right{right:-5px;bottom:-5px;cursor:nwse-resize}
</style>
