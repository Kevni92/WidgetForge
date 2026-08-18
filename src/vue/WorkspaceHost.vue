<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, toRaw } from 'vue'
import { calculateWorkspaceDockLayout, type DockManager, type DockState } from '../core/dock-manager'
import { containsPane, findPane, type PaneNode } from '../core/pane'
import type { WidgetRegistry } from '../core/widget-registry'
import type { WindowSize } from '../core/window-geometry'
import type { WindowManager } from '../core/window-manager'
import {
  detectWorkspaceDropZone,
  movePaneToTarget,
  relocatePaneBetweenTrees,
  workspaceDropPreviewRect,
  type WorkspaceDropRect,
  type WorkspaceDropZone,
} from '../core/workspace-docking'
import DockHost from './DockHost.vue'
import { observeElementSize } from './observe-element-size'
import WindowManagerHost from './WindowManagerHost.vue'

interface Props { windows: WindowManager; docks: DockManager; registry: WidgetRegistry }
type Owner = { readonly kind: 'window' | 'dock'; readonly id: string }
interface PaneDragSession { readonly sourceOwner: Owner; readonly sourcePaneId: string; readonly sourceElement: HTMLElement; readonly pointerId: number | undefined }
interface PaneDropTarget { readonly owner: Owner; readonly paneId: string; readonly zone: WorkspaceDropZone; readonly rect: WorkspaceDropRect }

const props = defineProps<Props>()
const windowManager = toRaw(props.windows)
const dockManager = toRaw(props.docks)
const registry = toRaw(props.registry)
const root = ref<HTMLElement | null>(null)
const size = shallowRef<WindowSize>({ width: 0, height: 0 })
const dockStates = shallowRef<readonly DockState[]>(dockManager.list())
const controlPressed = ref(false)
const paneDragActive = ref(false)
const paneDropPreview = shallowRef<PaneDropTarget | null>(null)
let disposeSize: (() => void) | null = null
let disposePaneDrag: (() => void) | null = null
let dropSequence = 0

const unsubscribe = dockManager.subscribe((change) => { dockStates.value = change.docks })
const layout = computed(() => calculateWorkspaceDockLayout(size.value, dockStates.value))
const editMode = computed(() => controlPressed.value || paneDragActive.value)

function rectStyle(rect: { x: number; y: number; width: number; height: number }): Record<string, string> {
  return { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` }
}

function ownerFromElement(element: Element): Owner | null {
  const windowElement = element.closest<HTMLElement>('[data-window-instance-id]')
  if (windowElement?.dataset.windowInstanceId) return { kind: 'window', id: windowElement.dataset.windowInstanceId }
  const dockElement = element.closest<HTMLElement>('[data-dock-id]')
  if (dockElement?.dataset.dockId) return { kind: 'dock', id: dockElement.dataset.dockId }
  return null
}

function ownerRoot(owner: Owner): PaneNode {
  return owner.kind === 'window' ? windowManager.get(owner.id).rootPane : dockManager.get(owner.id).rootPane
}

function setOwnerRoot(owner: Owner, pane: PaneNode): void {
  if (owner.kind === 'window') windowManager.setRootPane(owner.id, pane, 'user')
  else dockManager.setRootPane(owner.id, pane)
}

function sameOwner(left: Owner, right: Owner): boolean {
  return left.kind === right.kind && left.id === right.id
}

function containsPoint(rect: DOMRect, clientX: number, clientY: number): boolean {
  return rect.width > 0 && rect.height > 0 && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
}

function findDropTarget(session: PaneDragSession, clientX: number, clientY: number): PaneDropTarget | null {
  const workspace = root.value
  if (!workspace) return null
  const sourceRoot = ownerRoot(session.sourceOwner)
  const sourcePane = findPane(sourceRoot, session.sourcePaneId)
  if (!sourcePane) return null

  const candidates = [...workspace.querySelectorAll<HTMLElement>('.wf-pane-host[data-pane-id]')]
    .filter((element) => !session.sourceElement.contains(element))
    .filter((element) => containsPoint(element.getBoundingClientRect(), clientX, clientY))
    .sort((left, right) => {
      const a = left.getBoundingClientRect(); const b = right.getBoundingClientRect()
      return a.width * a.height - b.width * b.height
    })

  for (const element of candidates) {
    const paneId = element.dataset.paneId
    const owner = ownerFromElement(element)
    if (!paneId || !owner) continue
    if (sameOwner(owner, session.sourceOwner) && (paneId === session.sourcePaneId || containsPane(sourcePane, paneId))) continue
    const rect = element.getBoundingClientRect()
    const zone = detectWorkspaceDropZone({ x: clientX, y: clientY }, { x: rect.left, y: rect.top, width: rect.width, height: rect.height })
    if (!zone || (zone === 'center' && element.dataset.paneKind === 'split')) continue
    return { owner, paneId, zone, rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height } }
  }
  return null
}

function previewLocalRect(target: PaneDropTarget): WorkspaceDropRect {
  const workspace = root.value
  if (!workspace) return target.rect
  const rootRect = workspace.getBoundingClientRect()
  const preview = workspaceDropPreviewRect(target.zone, target.rect)
  return { x: preview.x - rootRect.left, y: preview.y - rootRect.top, width: preview.width, height: preview.height }
}

function commitPaneDrop(session: PaneDragSession, target: PaneDropTarget): void {
  dropSequence += 1
  const splitId = `workspace-drop-${dropSequence}`
  if (sameOwner(session.sourceOwner, target.owner)) {
    const next = movePaneToTarget(ownerRoot(session.sourceOwner), session.sourcePaneId, target.paneId, target.zone, splitId)
    setOwnerRoot(session.sourceOwner, next)
    return
  }

  if (session.sourceOwner.kind === 'dock' && ownerRoot(session.sourceOwner).id === session.sourcePaneId) return
  const result = relocatePaneBetweenTrees(ownerRoot(session.sourceOwner), session.sourcePaneId, ownerRoot(target.owner), target.paneId, target.zone, splitId)
  setOwnerRoot(target.owner, result.targetRoot)
  if (result.sourceRoot) setOwnerRoot(session.sourceOwner, result.sourceRoot)
  else if (session.sourceOwner.kind === 'window') windowManager.close(session.sourceOwner.id, 'user')
}

function finishPaneDrag(): void { disposePaneDrag?.() }

function startPaneDrag(event: PointerEvent): void {
  if (!event.ctrlKey || event.button !== 0) return
  const target = event.target
  if (!(target instanceof HTMLElement) || target.closest('[data-pane-divider-index], [data-window-resize-handle], [data-dock-resize]')) return
  const paneElement = target.closest<HTMLElement>('.wf-pane-host[data-pane-id]')
  if (!paneElement?.dataset.paneId) return
  const owner = ownerFromElement(paneElement)
  if (!owner) return

  const sourceRoot = ownerRoot(owner)
  if (!findPane(sourceRoot, paneElement.dataset.paneId)) return
  if (owner.kind === 'dock' && sourceRoot.id === paneElement.dataset.paneId) return

  event.preventDefault()
  event.stopPropagation()
  finishPaneDrag()
  paneDragActive.value = true

  const session: PaneDragSession = {
    sourceOwner: owner,
    sourcePaneId: paneElement.dataset.paneId,
    sourceElement: paneElement,
    pointerId: typeof event.pointerId === 'number' ? event.pointerId : undefined,
  }
  const matches = (next: PointerEvent): boolean => session.pointerId === undefined || typeof next.pointerId !== 'number' || next.pointerId === session.pointerId
  const move = (next: PointerEvent): void => {
    if (!matches(next)) return
    paneDropPreview.value = findDropTarget(session, next.clientX, next.clientY)
  }
  const cleanup = (): void => {
    globalThis.window.removeEventListener('pointermove', move)
    globalThis.window.removeEventListener('pointerup', end)
    globalThis.window.removeEventListener('pointercancel', end)
    paneDropPreview.value = null
    paneDragActive.value = false
    if (disposePaneDrag === cleanup) disposePaneDrag = null
  }
  const end = (next: PointerEvent): void => {
    if (!matches(next)) return
    const targetDrop = paneDropPreview.value
    if (next.type === 'pointerup' && targetDrop) commitPaneDrop(session, targetDrop)
    cleanup()
  }
  disposePaneDrag = cleanup
  globalThis.window.addEventListener('pointermove', move)
  globalThis.window.addEventListener('pointerup', end)
  globalThis.window.addEventListener('pointercancel', end)
}

function onKeyDown(event: KeyboardEvent): void { if (event.key === 'Control') controlPressed.value = true }
function onKeyUp(event: KeyboardEvent): void { if (event.key === 'Control') controlPressed.value = false }
function onBlur(): void { controlPressed.value = false }

onMounted(() => {
  if (root.value) disposeSize = observeElementSize(root.value, (next) => { size.value = next })
  globalThis.window.addEventListener('keydown', onKeyDown)
  globalThis.window.addEventListener('keyup', onKeyUp)
  globalThis.window.addEventListener('blur', onBlur)
})
onBeforeUnmount(() => {
  finishPaneDrag()
  disposeSize?.(); disposeSize = null; unsubscribe()
  globalThis.window.removeEventListener('keydown', onKeyDown)
  globalThis.window.removeEventListener('keyup', onKeyUp)
  globalThis.window.removeEventListener('blur', onBlur)
})
</script>

<template>
  <div ref="root" class="wf-workspace-host" :class="{ 'wf-workspace-host--edit': editMode }" :data-workspace-edit-mode="editMode" @pointerdown.capture="startPaneDrag">
    <div class="wf-workspace-host__floating" :style="rectStyle(layout.floating)" data-workspace-floating>
      <WindowManagerHost :manager="windowManager" :registry="registry" />
    </div>
    <DockHost v-for="dock in dockStates" :key="dock.id" :dock="dock" :rect="layout.docks[dock.id] ?? { x:0,y:0,width:0,height:0 }" :manager="dockManager" :registry="registry" />
    <div v-if="paneDropPreview" class="wf-workspace-pane-drop-preview" :data-pane-drop-target="paneDropPreview.paneId" :data-pane-drop-zone="paneDropPreview.zone" :style="rectStyle(previewLocalRect(paneDropPreview))" aria-hidden="true" />
  </div>
</template>

<style scoped>
.wf-workspace-host{position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;background:var(--wf-color-canvas)}
.wf-workspace-host__floating{position:absolute;min-width:0;min-height:0;overflow:hidden}
.wf-workspace-host--edit :deep(.wf-pane-host){outline:1px dashed var(--wf-color-border);outline-offset:-1px}
.wf-workspace-host--edit :deep(.wf-pane-host:hover){outline-color:var(--wf-color-focus)}
.wf-workspace-pane-drop-preview{position:absolute;z-index:var(--wf-layer-overlay);pointer-events:none;border:1px solid var(--wf-color-focus);background:var(--wf-color-selected);box-shadow:inset 0 0 0 1px var(--wf-color-border);outline:1px dashed var(--wf-color-accent);outline-offset:-3px}
</style>
