<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  nextTick,
  ref,
  shallowRef,
  toRaw,
} from "vue";
import {
  createContextMenuController,
  type ContextMenuController,
  type ContextMenuItem,
} from "../core/context-menu";
import {
  calculateWorkspaceDockLayout,
  type DockManager,
  type DockState,
} from "../core/dock-manager";
import {
  containsPane,
  findPane,
  removePane,
  reorderTab,
  setPaneSurfaceStyle,
  type PaneNode,
} from "../core/pane";
import { createDockInspectorSelection, createPaneInspectorSelection, createWindowInspectorSelection, type LayoutInspectorSelection } from '../core/layout-inspector'
import type { CommandRegistry } from "../core/commands";
import type { WidgetRegistry } from "../core/widget-registry";
import type { WindowGeometry, WindowSize } from "../core/window-geometry";
import type { WindowManager, WindowState } from "../core/window-manager";
import { createAbsoluteWindowLayoutSpec, createWindowLayoutConstraintDraft, deriveWindowLayoutStatus, removeWindowLayoutConstraint, resizeWindowLayoutSpec, resolveWindowLayoutSpecs, type WindowLayoutEdge, type WindowLayoutStatus, type WindowLayoutTarget } from '../core/window-layout'
import {
  createPaneEditContextMenuItems,
  createWorkspaceEditController,
  removePaneForEdit,
  type PaneEditActionId,
  type WorkspaceEditController,
  type WorkspaceEditState,
  type WorkspacePaneOwner,
  type WorkspacePaneSelection,
} from "../core/workspace-edit";
import type { LayoutSurfaceStyle } from '../core/layout-surface-style'
import type { WorkspaceHistory } from "../core/workspace-history";
import {
  detectWorkspaceDropZone,
  movePaneToTarget,
  relocatePaneBetweenTrees,
  detachDockToWindow,
  type WorkspaceDropRect,
  type WorkspaceDropZone,
} from "../core/workspace-docking";
import { commitWorkspacePaneMutations } from "../core/workspace";
import ContextMenuHost from "./ContextMenuHost.vue";
import DockHost from "./DockHost.vue";
import DockingOverlay from "./DockingOverlay.vue";
import { observeElementSize } from "./observe-element-size";
import { handleWorkspaceHistoryShortcut } from "./workspace-history-shortcuts";
import WindowManagerHost from "./WindowManagerHost.vue";
import WindowLayoutDialog, { type WindowLayoutDialogPreview, type WindowLayoutDialogSave } from './WindowLayoutDialog.vue'
import LayoutInspector from './LayoutInspector.vue'
import { provideWidgetDocumentationForHost } from './documentation-context'
import WfIcon from './WfIcon.vue'

interface Props {
  windows: WindowManager;
  docks: DockManager;
  registry: WidgetRegistry;
  commands?: CommandRegistry | undefined;
  launcherPlaceholder?: string | undefined;
  launcherSubmitLabel?: string | undefined;
  history?: WorkspaceHistory | undefined;
  historyShortcuts?: boolean | undefined;
  edit?: WorkspaceEditController | undefined;
  contextMenu?: ContextMenuController | undefined;
}
type LayoutInspectorMode = 'docked' | 'floating' | 'minimized';
interface LayoutInspectorFloatingPosition { readonly x: number; readonly y: number }
interface PaneDragSession {
  readonly sourceOwner: WorkspacePaneOwner;
  readonly sourcePaneId: string;
  readonly sourceTabPaneId?: string;
  readonly sourceElement: HTMLElement;
  readonly captureTarget: HTMLElement;
  readonly pointerId: number | undefined;
  readonly startX: number;
  readonly startY: number;
  started: boolean;
}
interface PaneDropTarget {
  readonly kind: "pane";
  readonly owner: WorkspacePaneOwner;
  readonly paneId: string;
  readonly zone: WorkspaceDropZone;
  readonly rect: WorkspaceDropRect;
}
interface PaneDetachTarget {
  readonly kind: "detach";
  readonly position: { x: number; y: number };
  readonly size: { width: number; height: number };
  readonly rect: WorkspaceDropRect;
}
type PaneDropPreview = PaneDropTarget | PaneDetachTarget;
interface TabReorderSession {
  readonly sourceOwner: WorkspacePaneOwner;
  readonly tabPaneId: string;
  readonly sourceTabId: string;
  readonly sourceIndex: number;
  readonly sourceElement: HTMLElement;
  readonly captureTarget: HTMLElement;
  readonly pointerId: number | undefined;
  readonly startX: number;
  readonly startY: number;
  started: boolean;
}
interface TabReorderPreview {
  readonly owner: WorkspacePaneOwner;
  readonly tabPaneId: string;
  readonly targetIndex: number;
  readonly rect: WorkspaceDropRect;
}
type PointerSessionKind =
  | "window-drag"
  | "window-resize"
  | "dock-resize"
  | "pane-resize"
  | "pane-drag"
  | "tab-reorder";
type LayoutResizeHandle = WindowLayoutEdge | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
interface ConstraintDropTarget {
  readonly target: WindowLayoutTarget;
  readonly x: number;
  readonly y: number;
  readonly edge: WindowLayoutEdge;
  readonly targetInstanceId?: string;
}
interface ConstraintLinkState {
  readonly sourceInstanceId: string;
  readonly sourceEdge: WindowLayoutEdge;
  readonly pointerId: number | undefined;
  readonly captureTarget: HTMLElement;
  readonly started: boolean;
  readonly pointer: { readonly x: number; readonly y: number };
  readonly target: ConstraintDropTarget | null;
}
interface ConstraintKeyboardOption { readonly target: WindowLayoutTarget; readonly label: string }
interface SelectedConstraint { readonly sourceInstanceId: string; readonly sourceEdge: WindowLayoutEdge; readonly targetId: string; readonly targetEdge: WindowLayoutEdge }
interface LayoutResizeSession {
  readonly sourceInstanceId: string;
  readonly handle: LayoutResizeHandle;
  readonly pointerId: number | undefined;
  readonly captureTarget: HTMLElement;
  readonly startX: number;
  readonly startY: number;
  readonly startGeometry: WindowGeometry;
  readonly startSpec: ReturnType<typeof createAbsoluteWindowLayoutSpec>;
  readonly container: WindowSize;
  readonly started: boolean;
  readonly preview: WindowLayoutDialogPreview | null;
}
interface HistoryPointerSession {
  readonly kind: PointerSessionKind;
  readonly pointerId: number | undefined;
}

const props = defineProps<Props>();
provideWidgetDocumentationForHost(props.registry, props.commands)
const emit = defineEmits<{
  paneAction: [action: PaneEditActionId, selection: WorkspacePaneSelection];
}>();
const windowManager = toRaw(props.windows);
const dockManager = toRaw(props.docks);
const registry = toRaw(props.registry);
const history = props.history ? toRaw(props.history) : undefined;
const editController = props.edit
  ? toRaw(props.edit)
  : createWorkspaceEditController();
const contextMenu = props.contextMenu
  ? toRaw(props.contextMenu)
  : createContextMenuController();
const root = ref<HTMLElement | null>(null);
const size = shallowRef<WindowSize>({ width: 0, height: 0 });
const windowStates = shallowRef<readonly WindowState[]>(windowManager.list());
const dockStates = shallowRef<readonly DockState[]>(dockManager.list());
const editState = shallowRef<WorkspaceEditState>(editController.state);
const paneDragActive = ref(false);
const paneDropPreview = shallowRef<PaneDropPreview | null>(null);
const tabReorderPreview = shallowRef<TabReorderPreview | null>(null);
const layoutDialogWindow = shallowRef<ReturnType<WindowManager['get']> | null>(null);
const layoutPreview = shallowRef<WindowLayoutDialogPreview | null>(null);
const constraintLink = shallowRef<ConstraintLinkState | null>(null);
const layoutResizeSession = shallowRef<LayoutResizeSession | null>(null);
const keyboardConstraintEdge = ref<WindowLayoutEdge | null>(null);
const layoutResizeActive = ref(false);
const selectedConstraint = shallowRef<SelectedConstraint | null>(null);
const suppressConstraintClick = ref(false);
const inspectorTransactionActive = ref(false);
const inspectorMode = ref<LayoutInspectorMode>('docked');
const inspectorFloatingPosition = shallowRef<LayoutInspectorFloatingPosition | undefined>(undefined);
const constraintEdges: readonly WindowLayoutEdge[] = ['top', 'right', 'bottom', 'left'];
const layoutResizeHandles: readonly LayoutResizeHandle[] = ['top', 'right', 'bottom', 'left', 'top-left', 'top-right', 'bottom-right', 'bottom-left'];
let disposeSize: (() => void) | null = null;
let disposePaneDrag: (() => void) | null = null;
let disposeTabReorder: (() => void) | null = null;
let disposeConstraintLink: (() => void) | null = null;
let disposeLayoutResize: (() => void) | null = null;
let pointerSession: HistoryPointerSession | null = null;
let dropSequence = 0;
let suppressClick = false;
const unsubscribeDock = dockManager.subscribe((change) => {
  dockStates.value = change.docks;
});
const unsubscribeWindow = windowManager.subscribe((change) => {
  windowStates.value = change.windows;
  queueMicrotask(syncEditMarkers);
});
const unsubscribeEdit = editController.subscribe((state) => {
  editState.value = state;
  if (state.mode !== 'edit') resetEditTransients();
  queueMicrotask(syncEditMarkers);
});
const layout = computed(() =>
  calculateWorkspaceDockLayout(size.value, dockStates.value),
);
const floatingSize = computed<WindowSize>(() => ({ width: layout.value.floating.width, height: layout.value.floating.height }));
const editMode = computed(
  () => editState.value.editActive || paneDragActive.value,
);
const layoutLocked = computed(() => editState.value.locked);
const selectedWindow = computed<WindowState | null>(() => {
  const id = editState.value.windowSelection?.instanceId ?? (editState.value.selection?.owner.kind === 'window' ? editState.value.selection.owner.id : null);
  return id ? windowStates.value.find((window) => window.instanceId === id) ?? null : null;
});
const selectedWindowStatus = computed<WindowLayoutStatus | null>(() => selectedWindow.value ? deriveWindowLayoutStatus(selectedWindow.value) : null)
const selectedDock = computed<DockState | null>(() => {
  const id = editState.value.dockSelection?.id
  return id ? dockStates.value.find((dock) => dock.id === id) ?? null : null
})
const selectedPane = computed<{ pane: PaneNode; owner: WorkspacePaneOwner } | null>(() => {
  const selection = editState.value.selection
  if (!selection) return null
  try {
    const pane = findPane(ownerRoot(selection.owner), selection.paneId)
    return pane ? { pane, owner: selection.owner } : null
  } catch { return null }
})
const inspectorSelection = computed<LayoutInspectorSelection | null>(() => {
  if (selectedPane.value && !(selectedPane.value.owner.kind === 'window' && selectedWindow.value?.rootPane.id === selectedPane.value.pane.id)) return createPaneInspectorSelection(selectedPane.value.pane, selectedPane.value.owner.kind, selectedPane.value.owner.id)
  if (selectedDock.value) return createDockInspectorSelection(selectedDock.value)
  if (selectedWindow.value) return createWindowInspectorSelection(selectedWindow.value)
  return null
})
function dockLayoutSelection(dockId: string): 'selected' | 'unselected' | undefined {
  if (!editMode.value) return undefined
  return editState.value.dockSelection?.id === dockId || (editState.value.selection?.owner.kind === 'dock' && editState.value.selection.owner.id === dockId) ? 'selected' : 'unselected'
}
interface LayoutRelation { readonly sourceId: string; readonly targetId: string; readonly sourceEdge: WindowLayoutEdge; readonly targetEdge: WindowLayoutEdge; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }
function edgePoint(geometry: WindowGeometry, edge: WindowLayoutEdge): { x: number; y: number } {
  if (edge === 'left') return { x: geometry.position.x, y: geometry.position.y + geometry.size.height / 2 }
  if (edge === 'right') return { x: geometry.position.x + geometry.size.width, y: geometry.position.y + geometry.size.height / 2 }
  if (edge === 'top') return { x: geometry.position.x + geometry.size.width / 2, y: geometry.position.y }
  return { x: geometry.position.x + geometry.size.width / 2, y: geometry.position.y + geometry.size.height }
}
function workspaceEdgePoint(container: WindowSize, edge: WindowLayoutEdge): { x: number; y: number } {
  if (edge === 'left') return { x: 0, y: container.height / 2 }
  if (edge === 'right') return { x: container.width, y: container.height / 2 }
  if (edge === 'top') return { x: container.width / 2, y: 0 }
  return { x: container.width / 2, y: container.height }
}
function constraintSourceEdge(axis: 'horizontal' | 'vertical', side: 'start' | 'end'): WindowLayoutEdge {
  if (axis === 'horizontal') return side === 'start' ? 'left' : 'right'
  return side === 'start' ? 'top' : 'bottom'
}
const layoutRelations = computed<readonly LayoutRelation[]>(() => {
  const selectedId = selectedWindow.value?.instanceId
  if (!selectedId) return []
  const byId = new Map(windowStates.value.map((window) => [window.instanceId, window]))
  return windowStates.value.flatMap((source) => {
    if (source.instanceId !== selectedId) return []
    const previewSource = layoutPreview.value?.sourceInstanceId === source.instanceId ? layoutPreview.value : null
    const spec = previewSource?.layoutSpec ?? source.layoutSpec
    if (!spec) return []
    const sourceGeometry = previewSource?.geometry ?? source.geometry
    const anchors: readonly [WindowLayoutEdge, typeof spec.horizontal.start | typeof spec.horizontal.end][] = [
      [constraintSourceEdge('horizontal', 'start'), spec.horizontal.start],
      [constraintSourceEdge('horizontal', 'end'), spec.horizontal.end],
      [constraintSourceEdge('vertical', 'start'), spec.vertical.start],
      [constraintSourceEdge('vertical', 'end'), spec.vertical.end],
    ]
    return anchors.flatMap(([sourceEdge, anchor]) => {
      if (!anchor) return []
      if (anchor.target.kind === 'workspace' && (source.layoutSpecState !== 'active' || (previewSource && !layoutResizeActive.value))) return []
      const sourcePoint = edgePoint(sourceGeometry, sourceEdge)
      const targetPoint = anchor.target.kind === 'window'
        ? (() => {
          const target = byId.get(anchor.target.instanceId)
          if (!target) return null
          const targetGeometry = layoutPreview.value?.sourceInstanceId === target.instanceId ? layoutPreview.value.geometry : target.geometry
          return edgePoint(targetGeometry, anchor.target.edge)
        })()
        : workspaceEdgePoint(floatingSize.value, anchor.target.edge)
      if (!targetPoint) return []
      const targetId = anchor.target.kind === 'window' ? anchor.target.instanceId : 'workspace'
      return [{ sourceId: source.instanceId, targetId, sourceEdge, targetEdge: anchor.target.edge, x1: layout.value.floating.x + sourcePoint.x, y1: layout.value.floating.y + sourcePoint.y, x2: layout.value.floating.x + targetPoint.x, y2: layout.value.floating.y + targetPoint.y }]
    })
  })
})
function selectConstraint(relation: LayoutRelation): void {
  selectedConstraint.value = {
    sourceInstanceId: relation.sourceId,
    sourceEdge: relation.sourceEdge,
    targetId: relation.targetId,
    targetEdge: relation.targetEdge,
  };
}
function selectInspectorConstraint(edge: WindowLayoutEdge): void {
  const relation = layoutRelations.value.find((candidate) => candidate.sourceId === selectedWindow.value?.instanceId && candidate.sourceEdge === edge);
  if (relation) selectConstraint(relation);
}
const selectedConstraintLabel = computed(() => {
  const constraint = selectedConstraint.value;
  if (!constraint) return null;
  const target = constraint.targetId === 'workspace' ? 'workspace' : windowStates.value.find((window) => window.instanceId === constraint.targetId)?.title ?? constraint.targetId;
  return `${constraint.sourceEdge} → ${target} · ${constraint.targetEdge}`;
});
function removeSelectedConstraint(): void {
  const constraint = selectedConstraint.value;
  if (!constraint || layoutLocked.value) return;
  const source = windowStates.value.find((window) => window.instanceId === constraint.sourceInstanceId);
  if (!source?.layoutSpec) return;
  try {
    history?.beginTransaction();
    const spec = removeWindowLayoutConstraint(source.layoutSpec, source.geometry, constraint.sourceEdge);
    windowManager.setLayoutSpec(source.instanceId, spec, windowManager.getResponsiveContainer() ?? floatingSize.value, 'user', 'active');
    history?.commitTransaction();
    selectedConstraint.value = null;
  } catch {
    history?.cancelTransaction();
  }
}

function layoutResizeContainer(window: WindowState): WindowSize {
  const known = windowManager.getResponsiveContainer();
  if (known && known.width > 0 && known.height > 0) return known;
  if (floatingSize.value.width > 0 && floatingSize.value.height > 0) return floatingSize.value;
  return {
    width: Math.max(1, window.geometry.position.x + window.geometry.size.width),
    height: Math.max(1, window.geometry.position.y + window.geometry.size.height),
  };
}
function layoutResizePreviewFor(session: LayoutResizeSession, clientX: number, clientY: number): WindowLayoutDialogPreview {
  const deltaX = clientX - session.startX;
  const deltaY = clientY - session.startY;
  let spec = session.startSpec;
  if (session.handle === 'left' || session.handle === 'right' || session.handle === 'top-left' || session.handle === 'top-right' || session.handle === 'bottom-left' || session.handle === 'bottom-right') {
    const edge = session.handle === 'left' || session.handle.endsWith('left') ? 'left' : 'right';
    spec = resizeWindowLayoutSpec(spec, session.startGeometry, edge, deltaX, session.container, windowStates.value.find((window) => window.instanceId === session.sourceInstanceId)?.constraints ?? { minSize: { width: 0, height: 0 }, maxSize: null });
  }
  if (session.handle === 'top' || session.handle === 'bottom' || session.handle === 'top-left' || session.handle === 'top-right' || session.handle === 'bottom-left' || session.handle === 'bottom-right') {
    const edge = session.handle === 'top' || session.handle.startsWith('top') ? 'top' : 'bottom';
    spec = resizeWindowLayoutSpec(spec, session.startGeometry, edge, deltaY, session.container, windowStates.value.find((window) => window.instanceId === session.sourceInstanceId)?.constraints ?? { minSize: { width: 0, height: 0 }, maxSize: null });
  }
  const resolved = resolveWindowLayoutSpecs(windowStates.value.map((window) => window.instanceId === session.sourceInstanceId ? { ...window, layoutSpec: spec } : window), session.container);
  const geometry = resolved.get(session.sourceInstanceId);
  if (!geometry) throw new Error('Window geometry could not be resolved')
  return { sourceInstanceId: session.sourceInstanceId, layoutSpec: spec, geometry };
}
function clearLayoutResizePreview(): void {
  const active = layoutResizeActive.value;
  layoutResizeSession.value = null;
  layoutResizeActive.value = false;
  if (active) layoutPreview.value = null;
}
function finishLayoutResize(cancel = true): void {
  if (!layoutResizeSession.value) return;
  if (cancel) history?.cancelTransaction();
  disposeLayoutResize?.();
  disposeLayoutResize = null;
  clearLayoutResizePreview();
}
function commitLayoutResize(): void {
  const session = layoutResizeSession.value;
  if (!session?.started || !session.preview?.layoutSpec) { finishLayoutResize(); return; }
  try {
    windowManager.setLayoutSpec(session.sourceInstanceId, session.preview.layoutSpec, session.container, 'user', 'active');
    history?.commitTransaction();
    finishLayoutResize(false);
  } catch {
    finishLayoutResize();
  }
}
function layoutResizeHandleStyle(handle: LayoutResizeHandle): Record<string, string> {
  const geometry = selectedWindow.value?.geometry;
  if (!geometry) return {};
  const x = layout.value.floating.x + geometry.position.x;
  const y = layout.value.floating.y + geometry.position.y;
  const width = geometry.size.width;
  const height = geometry.size.height;
  const edgeSize = 10;
  const cornerSize = 16;
  if (handle === 'top') return { left: `${x + cornerSize}px`, top: `${y - edgeSize / 2}px`, width: `${Math.max(0, width - cornerSize * 2)}px`, height: `${edgeSize}px` };
  if (handle === 'right') return { left: `${x + width - edgeSize / 2}px`, top: `${y + cornerSize}px`, width: `${edgeSize}px`, height: `${Math.max(0, height - cornerSize * 2)}px` };
  if (handle === 'bottom') return { left: `${x + cornerSize}px`, top: `${y + height - edgeSize / 2}px`, width: `${Math.max(0, width - cornerSize * 2)}px`, height: `${edgeSize}px` };
  if (handle === 'left') return { left: `${x - edgeSize / 2}px`, top: `${y + cornerSize}px`, width: `${edgeSize}px`, height: `${Math.max(0, height - cornerSize * 2)}px` };
  const left = handle.endsWith('left');
  const top = handle.startsWith('top');
  return { left: `${x + (left ? -cornerSize / 2 : width - cornerSize / 2)}px`, top: `${y + (top ? -cornerSize / 2 : height - cornerSize / 2)}px`, width: `${cornerSize}px`, height: `${cornerSize}px` };
}
function startLayoutResize(event: PointerEvent, handle: LayoutResizeHandle): void {
  const captureTarget = event.currentTarget;
  const source = selectedWindow.value;
  if (!(captureTarget instanceof HTMLElement) || !source || !editState.value.editActive || layoutLocked.value || event.button !== 0 || source.instanceId !== captureTarget.dataset.windowLayoutResizeSource || !source.options.resizable) return;
  event.preventDefault();
  event.stopPropagation();
  finishLayoutResize();
  const pointerId = typeof event.pointerId === 'number' ? event.pointerId : undefined;
  const container = layoutResizeContainer(source);
  const session: LayoutResizeSession = { sourceInstanceId: source.instanceId, handle, pointerId, captureTarget, startX: event.clientX, startY: event.clientY, startGeometry: { position: { ...source.geometry.position }, size: { ...source.geometry.size } }, startSpec: source.layoutSpec ? source.layoutSpec : createAbsoluteWindowLayoutSpec(source.geometry), container, started: false, preview: null };
  layoutResizeSession.value = session;
  layoutResizeActive.value = true;
  history?.beginTransaction();
  if (pointerId !== undefined && typeof captureTarget.setPointerCapture === 'function') { try { captureTarget.setPointerCapture(pointerId); } catch { /* optional */ } }
  const matches = (next: PointerEvent): boolean => pointerId === undefined || typeof next.pointerId !== 'number' || next.pointerId === pointerId;
  const move = (next: PointerEvent): void => {
    if (!matches(next)) return;
    if (!session.started && Math.hypot(next.clientX - session.startX, next.clientY - session.startY) < 4) return;
    try {
      const preview = layoutResizePreviewFor(session, next.clientX, next.clientY);
      layoutResizeSession.value = { ...session, started: true, preview };
      layoutPreview.value = preview;
    } catch {
      layoutPreview.value = session.preview;
    }
  };
  const cleanup = (): void => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', cancel);
    captureTarget.removeEventListener('lostpointercapture', lost);
    if (pointerId !== undefined && typeof captureTarget.releasePointerCapture === 'function') { try { captureTarget.releasePointerCapture(pointerId); } catch { /* optional */ } }
    if (disposeLayoutResize === cleanup) disposeLayoutResize = null;
  };
  const end = (next: PointerEvent): void => {
    if (!matches(next)) return;
    if (next.type === 'pointerup') commitLayoutResize();
    else finishLayoutResize();
    cleanup();
  };
  const cancel = (): void => { finishLayoutResize(); cleanup(); };
  const lost = (): void => { finishLayoutResize(); cleanup(); };
  disposeLayoutResize = cleanup;
  captureTarget.addEventListener('lostpointercapture', lost);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', cancel);
}

function rectStyle(rect: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Record<string, string> {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };
}
function rootLocalPoint(clientX: number, clientY: number): { x: number; y: number } {
  const rect = root.value?.getBoundingClientRect();
  return rect ? { x: clientX - rect.left, y: clientY - rect.top } : { x: clientX, y: clientY };
}
function constraintHandleStyle(edge: WindowLayoutEdge): Record<string, string> {
  const geometry = selectedWindow.value?.geometry;
  if (!geometry) return {};
  const x = layout.value.floating.x + geometry.position.x;
  const y = layout.value.floating.y + geometry.position.y;
  if (edge === 'left') return { left: `${x}px`, top: `${y + geometry.size.height / 2}px` };
  if (edge === 'right') return { left: `${x + geometry.size.width}px`, top: `${y + geometry.size.height / 2}px` };
  if (edge === 'top') return { left: `${x + geometry.size.width / 2}px`, top: `${y}px` };
  return { left: `${x + geometry.size.width / 2}px`, top: `${y + geometry.size.height}px` };
}
function constraintLinePoint(edge: WindowLayoutEdge): { x: number; y: number } | null {
  const geometry = selectedWindow.value?.geometry;
  if (!geometry) return null;
  const point = edgePoint(geometry, edge);
  return { x: layout.value.floating.x + point.x, y: layout.value.floating.y + point.y };
}
function constraintLinkLine(): { x1: number; y1: number; x2: number; y2: number } | null {
  const link = constraintLink.value;
  const source = link ? constraintLinePoint(link.sourceEdge) : null;
  if (!link || !source) return null;
  return { x1: source.x, y1: source.y, x2: link.pointer.x, y2: link.pointer.y };
}
function constraintTargetMarkerStyle(target: ConstraintDropTarget): Record<string, string> {
  if (target.edge === 'left' || target.edge === 'right') return { left: `${target.x - 2}px`, top: `${target.y - 18}px`, width: '4px', height: '36px' };
  return { left: `${target.x - 18}px`, top: `${target.y - 2}px`, width: '36px', height: '4px' };
}
const constraintKeyboardOptions = computed<readonly ConstraintKeyboardOption[]>(() => {
  const source = selectedWindow.value;
  const sourceEdge = keyboardConstraintEdge.value;
  if (!source || !sourceEdge) return [];
  const edges: readonly WindowLayoutEdge[] = sourceEdge === 'left' || sourceEdge === 'right' ? ['left', 'right'] : ['top', 'bottom'];
  const targets: Array<ConstraintKeyboardOption> = edges.map((edge) => ({ target: { kind: 'workspace', edge }, label: `Workspace · ${edge[0]?.toUpperCase()}${edge.slice(1)}` }));
  for (const window of windowStates.value) {
    if (window.instanceId === source.instanceId) continue;
    for (const edge of edges) targets.push({ target: { kind: 'window', instanceId: window.instanceId, edge }, label: `${window.title} · ${window.instanceId} · ${edge}` });
  }
  return targets.filter((option) => {
    try { createWindowLayoutConstraintDraft(windowStates.value, source.instanceId, sourceEdge, option.target); return true; }
    catch { return false; }
  });
});
function startConstraintKeyboardSelection(edge: WindowLayoutEdge): void {
  if (suppressConstraintClick.value) {
    suppressConstraintClick.value = false;
    return;
  }
  if (!editState.value.editActive || layoutLocked.value || !selectedWindow.value) return;
  keyboardConstraintEdge.value = edge;
}
function commitKeyboardConstraint(option: ConstraintKeyboardOption): void {
  const source = selectedWindow.value;
  const sourceEdge = keyboardConstraintEdge.value;
  if (!source || !sourceEdge) return;
  try {
    history?.beginTransaction();
    const spec = createWindowLayoutConstraintDraft(windowStates.value, source.instanceId, sourceEdge, option.target);
    windowManager.setLayoutSpec(source.instanceId, spec, floatingSize.value, 'user', 'active');
    history?.commitTransaction();
    keyboardConstraintEdge.value = null;
  } catch {
    history?.cancelTransaction();
  }
}
function constraintGhostStyle(): Record<string, string> | null {
  const link = constraintLink.value;
  if (!link?.target) return null;
  const source = windowStates.value.find((window) => window.instanceId === link.sourceInstanceId);
  if (!source) return null;
  try {
    const spec = createWindowLayoutConstraintDraft(windowStates.value, link.sourceInstanceId, link.sourceEdge, link.target.target);
    const resolved = resolveWindowLayoutSpecs(windowStates.value.map((window) => window.instanceId === link.sourceInstanceId ? { ...window, layoutSpec: spec } : window), floatingSize.value);
    const geometry = resolved.get(link.sourceInstanceId);
    return geometry ? previewRectStyle({ sourceInstanceId: link.sourceInstanceId, geometry, layoutSpec: spec }) : null;
  } catch {
    return null;
  }
}
function constraintTargetAtPoint(sourceInstanceId: string, sourceEdge: WindowLayoutEdge, clientX: number, clientY: number): ConstraintDropTarget | null {
  const rootElement = root.value;
  if (!rootElement) return null;
  const axis = sourceEdge === 'left' || sourceEdge === 'right' ? 'horizontal' : 'vertical';
  const rootRect = rootElement.getBoundingClientRect();
  const hitDistance = 24;
  const candidates: Array<ConstraintDropTarget & { distance: number }> = [];
  const add = (target: WindowLayoutTarget, edge: WindowLayoutEdge, x: number, y: number, distance: number, targetInstanceId?: string): void => {
    if (distance > hitDistance) return;
    try { createWindowLayoutConstraintDraft(windowStates.value, sourceInstanceId, sourceEdge, target); }
    catch { return; }
    candidates.push({ target, edge, x, y, distance, ...(targetInstanceId ? { targetInstanceId } : {}) });
  };
  for (const frame of rootElement.querySelectorAll<HTMLElement>('.wf-window-frame[data-window-instance-id]')) {
    const targetInstanceId = frame.dataset.windowInstanceId;
    if (!targetInstanceId || targetInstanceId === sourceInstanceId) continue;
    const rect = frame.getBoundingClientRect();
    if (axis === 'horizontal' && clientY >= rect.top - hitDistance && clientY <= rect.bottom + hitDistance) {
      add({ kind: 'window', instanceId: targetInstanceId, edge: 'left' }, 'left', rect.left - rootRect.left, (rect.top + rect.bottom) / 2 - rootRect.top, Math.abs(clientX - rect.left), targetInstanceId);
      add({ kind: 'window', instanceId: targetInstanceId, edge: 'right' }, 'right', rect.right - rootRect.left, (rect.top + rect.bottom) / 2 - rootRect.top, Math.abs(clientX - rect.right), targetInstanceId);
    }
    if (axis === 'vertical' && clientX >= rect.left - hitDistance && clientX <= rect.right + hitDistance) {
      add({ kind: 'window', instanceId: targetInstanceId, edge: 'top' }, 'top', (rect.left + rect.right) / 2 - rootRect.left, rect.top - rootRect.top, Math.abs(clientY - rect.top), targetInstanceId);
      add({ kind: 'window', instanceId: targetInstanceId, edge: 'bottom' }, 'bottom', (rect.left + rect.right) / 2 - rootRect.left, rect.bottom - rootRect.top, Math.abs(clientY - rect.bottom), targetInstanceId);
    }
  }
  const floatingRect = rootElement.querySelector<HTMLElement>('[data-workspace-floating]')?.getBoundingClientRect();
  if (floatingRect) {
    if (axis === 'horizontal' && clientY >= floatingRect.top && clientY <= floatingRect.bottom) {
      add({ kind: 'workspace', edge: 'left' }, 'left', floatingRect.left - rootRect.left, (floatingRect.top + floatingRect.bottom) / 2 - rootRect.top, Math.abs(clientX - floatingRect.left));
      add({ kind: 'workspace', edge: 'right' }, 'right', floatingRect.right - rootRect.left, (floatingRect.top + floatingRect.bottom) / 2 - rootRect.top, Math.abs(clientX - floatingRect.right));
    }
    if (axis === 'vertical' && clientX >= floatingRect.left && clientX <= floatingRect.right) {
      add({ kind: 'workspace', edge: 'top' }, 'top', (floatingRect.left + floatingRect.right) / 2 - rootRect.left, floatingRect.top - rootRect.top, Math.abs(clientY - floatingRect.top));
      add({ kind: 'workspace', edge: 'bottom' }, 'bottom', (floatingRect.left + floatingRect.right) / 2 - rootRect.left, floatingRect.bottom - rootRect.top, Math.abs(clientY - floatingRect.bottom));
    }
  }
  return candidates.sort((left, right) => left.distance - right.distance)[0] ?? null;
}
function finishConstraintLink(cancel = true): void {
  if (!constraintLink.value) return;
  if (cancel) history?.cancelTransaction();
  disposeConstraintLink?.();
}
function commitConstraintLink(): void {
  const link = constraintLink.value;
  if (!link?.started || !link.target) { finishConstraintLink(); return; }
  suppressConstraintClick.value = true;
  try {
    const spec = createWindowLayoutConstraintDraft(windowStates.value, link.sourceInstanceId, link.sourceEdge, link.target.target);
    windowManager.setLayoutSpec(link.sourceInstanceId, spec, floatingSize.value, 'user', 'active');
    history?.commitTransaction();
    finishConstraintLink(false);
  } catch {
    finishConstraintLink();
  }
}
function startConstraintLink(event: PointerEvent, sourceEdge: WindowLayoutEdge): void {
  const captureTarget = event.currentTarget;
  if (!(captureTarget instanceof HTMLElement)) return;
  const sourceWindow = selectedWindow.value;
  if (!sourceWindow || !editState.value.editActive || layoutLocked.value || event.button !== 0 || sourceWindow.instanceId !== captureTarget.dataset.windowConstraintSource) return;
  event.preventDefault();
  event.stopPropagation();
  finishConstraintLink();
  const pointerId = typeof event.pointerId === 'number' ? event.pointerId : undefined;
  const point = rootLocalPoint(event.clientX, event.clientY);
  const session: ConstraintLinkState = { sourceInstanceId: sourceWindow.instanceId, sourceEdge, pointerId, captureTarget, started: false, pointer: point, target: null };
  constraintLink.value = session;
  history?.beginTransaction();
  if (pointerId !== undefined && typeof captureTarget.setPointerCapture === 'function') { try { captureTarget.setPointerCapture(pointerId); } catch { /* optional */ } }
  const matches = (next: PointerEvent): boolean => pointerId === undefined || typeof next.pointerId !== 'number' || next.pointerId === pointerId;
  const move = (next: PointerEvent): void => {
    if (!matches(next)) return;
    const started = session.started || Math.hypot(next.clientX - event.clientX, next.clientY - event.clientY) >= 4;
    if (!started) return;
    const target = constraintTargetAtPoint(session.sourceInstanceId, sourceEdge, next.clientX, next.clientY);
    constraintLink.value = { ...session, started: true, pointer: rootLocalPoint(next.clientX, next.clientY), target };
  };
  const cleanup = (): void => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', cancel);
    captureTarget.removeEventListener('lostpointercapture', lost);
    if (pointerId !== undefined && typeof captureTarget.releasePointerCapture === 'function') { try { captureTarget.releasePointerCapture(pointerId); } catch { /* optional */ } }
    constraintLink.value = null;
    if (disposeConstraintLink === cleanup) disposeConstraintLink = null;
  };
  const end = (next: PointerEvent): void => {
    if (!matches(next)) return;
    if (next.type === 'pointerup') commitConstraintLink();
    else finishConstraintLink();
  };
  const cancel = (): void => finishConstraintLink();
  const lost = (): void => finishConstraintLink();
  disposeConstraintLink = cleanup;
  captureTarget.addEventListener('lostpointercapture', lost);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', cancel);
}
function ownerFromElement(element: Element): WorkspacePaneOwner | null {
  const windowElement = element.closest<HTMLElement>(
    "[data-window-instance-id]",
  );
  if (windowElement?.dataset.windowInstanceId)
    return { kind: "window", id: windowElement.dataset.windowInstanceId };
  const dockElement = element.closest<HTMLElement>("[data-dock-id]");
  return dockElement?.dataset.dockId
    ? { kind: "dock", id: dockElement.dataset.dockId }
    : null;
}
function ownerRoot(owner: WorkspacePaneOwner): PaneNode {
  return owner.kind === "window"
    ? windowManager.get(owner.id).rootPane
    : dockManager.get(owner.id).rootPane;
}
function setOwnerRoot(owner: WorkspacePaneOwner, pane: PaneNode): void {
  if (!layoutLocked.value)
    commitWorkspacePaneMutations(windowManager, dockManager, [
      { owner, rootPane: pane },
    ]);
}
function detachDock(dockId: string): void {
  if (layoutLocked.value) return;
  history?.beginTransaction();
  try {
    detachDockToWindow(windowManager, dockManager, { dockId });
    history?.commitTransaction();
  } catch (error) {
    history?.cancelTransaction();
    throw error;
  }
}
function sameOwner(a: WorkspacePaneOwner, b: WorkspacePaneOwner): boolean {
  return a.kind === b.kind && a.id === b.id;
}
function selectionFor(
  element: Element,
  paneId: string,
): WorkspacePaneSelection | null {
  const owner = ownerFromElement(element);
  return owner ? { owner, paneId } : null;
}
function containsPoint(rect: DOMRect, x: number, y: number): boolean {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    x >= rect.left &&
    x <= rect.right &&
    y >= rect.top &&
    y <= rect.bottom
  );
}
function paneAtPoint(windowId: string, x: number, y: number): HTMLElement | null {
  const frame = [...(root.value?.querySelectorAll<HTMLElement>('.wf-window-frame[data-window-instance-id]') ?? [])]
    .find((element) => element.dataset.windowInstanceId === windowId);
  if (!frame) return null;
  return [...frame.querySelectorAll<HTMLElement>('.wf-pane-host[data-pane-id]')]
    .filter((element) => containsPoint(element.getBoundingClientRect(), x, y))
    .sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return ar.width * ar.height - br.width * br.height;
    })[0] ?? null;
}
function paneDragAllowed(owner: WorkspacePaneOwner, paneId: string): boolean {
  if (layoutLocked.value) return false;
  if (owner.kind === "window" && windowManager.get(owner.id).layoutLocked) return false;
  const pane = findPane(ownerRoot(owner), paneId);
  return Boolean(
    pane &&
    !pane.settings?.locked &&
    !editController.isPaneLocked({ owner, paneId }),
  );
}
function windowPaneDragEnabled(windowId: string, paneId: string): boolean {
  return paneDragAllowed({ kind: "window", id: windowId }, paneId);
}
function dockPaneDragEnabled(dockId: string, paneId: string): boolean {
  return paneDragAllowed({ kind: "dock", id: dockId }, paneId);
}
function syncEditMarkers(): void {
  const workspace = root.value;
  if (!workspace) return;
  for (const element of workspace.querySelectorAll<HTMLElement>(
    ".wf-pane-host[data-pane-id]",
  )) {
    element.removeAttribute("data-pane-selected");
    element.removeAttribute("data-layout-selection");
    element.removeAttribute("data-pane-layout-locked");
    const paneId = element.dataset.paneId;
    if (!paneId) continue;
    const selection = selectionFor(element, paneId);
    if (!selection) continue;
    if (
      editState.value.selection &&
      sameOwner(selection.owner, editState.value.selection.owner) &&
      selection.paneId === editState.value.selection.paneId
    )
      element.dataset.paneSelected = "true";
    if (editMode.value)
      element.dataset.layoutSelection = element.dataset.paneSelected === "true" ? "selected" : "unselected";
    if (editController.isPaneLocked(selection))
      element.dataset.paneLayoutLocked = "true";
  }
  for (const element of workspace.querySelectorAll<HTMLElement>(
    ".wf-window-frame[data-window-instance-id]",
  )) {
    element.removeAttribute("data-window-selected");
    element.removeAttribute("data-layout-selection");
    const instanceId = element.dataset.windowInstanceId;
    const selectedWindowId = editState.value.windowSelection?.instanceId ?? (editState.value.selection?.owner.kind === 'window' ? editState.value.selection.owner.id : null);
    if (
      instanceId &&
      selectedWindowId === instanceId
    ) {
      element.dataset.windowSelected = "true";
      element.dataset.layoutSelection = "selected";
    } else if (editState.value.editActive) {
      element.dataset.layoutSelection = "unselected";
    }
  }
}

function findDropTarget(
  session: PaneDragSession,
  x: number,
  y: number,
): PaneDropTarget | null {
  const workspace = root.value;
  if (!workspace || layoutLocked.value) return null;
  const source = findPane(ownerRoot(session.sourceOwner), session.sourcePaneId);
  if (!source) return null;
  const candidates = [
    ...workspace.querySelectorAll<HTMLElement>(".wf-pane-host[data-pane-id]"),
  ]
    .filter(
      (element) =>
        !session.sourceElement.contains(element) &&
        containsPoint(element.getBoundingClientRect(), x, y),
    )
    .sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return ar.width * ar.height - br.width * br.height;
    });
  for (const candidate of candidates) {
    const candidateRect = candidate.getBoundingClientRect();
    const detectedZone = detectWorkspaceDropZone(
      { x, y },
      {
        x: candidateRect.left,
        y: candidateRect.top,
        width: candidateRect.width,
        height: candidateRect.height,
      },
    );
    if (!detectedZone) continue;
    const element =
      detectedZone === "center"
        ? (candidate.closest<HTMLElement>(
            '.wf-pane-host[data-pane-kind="tabs"]',
          ) ?? candidate)
        : candidate;
    const paneId = element.dataset.paneId;
    const owner = ownerFromElement(element);
    if (!paneId || !owner) continue;
    if (
      session.sourceTabPaneId &&
      sameOwner(owner, session.sourceOwner) &&
      paneId === session.sourceTabPaneId
    )
      continue;
    if (
      !paneDragAllowed(owner, paneId) ||
      editController.isPaneLocked({ owner, paneId })
    )
      continue;
    if (
      sameOwner(owner, session.sourceOwner) &&
      (paneId === session.sourcePaneId || containsPane(source, paneId))
    )
      continue;
    const rect = element.getBoundingClientRect();
    return {
      kind: "pane",
      owner,
      paneId,
      zone:
        detectWorkspaceDropZone(
          { x, y },
          { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        ) ?? detectedZone,
      rect: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      },
    };
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function findDetachTarget(
  session: PaneDragSession,
  x: number,
  y: number,
): PaneDetachTarget | null {
  const workspace = root.value;
  if (!workspace || layoutLocked.value) return null;
  if (!findPane(ownerRoot(session.sourceOwner), session.sourcePaneId)) return null;

  const workspaceRect = workspace.getBoundingClientRect();
  if (!containsPoint(workspaceRect, x, y)) return null;

  const occupied = [
    ...workspace.querySelectorAll<HTMLElement>(
      ".wf-pane-host[data-pane-id], [data-window-instance-id], [data-dock-id]",
    ),
  ].some((element) => containsPoint(element.getBoundingClientRect(), x, y));
  if (occupied) return null;

  const hit = document.elementFromPoint?.(x, y);
  if (
    hit?.closest(
      ".wf-pane-host[data-pane-id], [data-window-instance-id], [data-dock-id]",
    )
  )
    return null;

  const sourceRect = session.captureTarget.getBoundingClientRect();
  const availableWidth = Math.max(1, workspaceRect.width - 16);
  const availableHeight = Math.max(1, workspaceRect.height - 16);
  const width = Math.min(
    session.sourceTabPaneId ? 320 : Math.max(sourceRect.width, 280),
    availableWidth,
  );
  const height = Math.min(
    session.sourceTabPaneId ? 220 : Math.max(sourceRect.height, 180),
    availableHeight,
  );
  const position = {
    x: clamp(
      x - workspaceRect.left - width / 2,
      0,
      Math.max(0, workspaceRect.width - width),
    ),
    y: clamp(
      y - workspaceRect.top - 24,
      0,
      Math.max(0, workspaceRect.height - height),
    ),
  };
  return {
    kind: "detach",
    position,
    size: { width, height },
    rect: {
      x: workspaceRect.left + position.x,
      y: workspaceRect.top + position.y,
      width,
      height,
    },
  };
}

function localTargetRect(
  target: PaneDropTarget | PaneDetachTarget | TabReorderPreview,
): WorkspaceDropRect {
  const workspace = root.value;
  if (!workspace) return target.rect;
  const rect = workspace.getBoundingClientRect();
  return {
    x: target.rect.x - rect.left,
    y: target.rect.y - rect.top,
    width: target.rect.width,
    height: target.rect.height,
  };
}

function nextDetachedWindowInstanceId(): string {
  let sequence = dropSequence;
  let instanceId = `workspace-detached-${sequence}`;
  while (windowManager.list().some((window) => window.instanceId === instanceId)) {
    sequence += 1;
    instanceId = `workspace-detached-${sequence}`;
  }
  return instanceId;
}

function commitPaneDetach(
  session: PaneDragSession,
  target: PaneDetachTarget,
): void {
  if (layoutLocked.value) return;
  dropSequence += 1;
  const sourceRoot = ownerRoot(session.sourceOwner);
  const removed = removePane(sourceRoot, session.sourcePaneId);
  const instanceId = nextDetachedWindowInstanceId();

  commitWorkspacePaneMutations(windowManager, dockManager, [
    { owner: session.sourceOwner, rootPane: removed.root },
  ]);
  try {
    windowManager.openPane(
      {
        instanceId,
        pane: removed.removed,
        position: target.position,
        size: target.size,
      },
      "user",
    );
  } catch (error) {
    try {
      if (windowManager.list().some((window) => window.instanceId === instanceId))
        windowManager.close(instanceId, "user");
      commitWorkspacePaneMutations(windowManager, dockManager, [
        { owner: session.sourceOwner, rootPane: sourceRoot },
      ]);
    } catch {
      // Preserve the original error; the workspace mutation helper already
      // reports rollback failures when the source commit itself fails.
    }
    throw error;
  }
}
function tabReorderIndicatorStyle(
  preview: TabReorderPreview,
): Record<string, string> {
  return { ...rectStyle(localTargetRect(preview)), width: "2px" };
}
function commitPaneDrop(
  session: PaneDragSession,
  target: PaneDropTarget,
): void {
  if (layoutLocked.value) return;
  dropSequence += 1;
  const id = `workspace-drop-${dropSequence}`;
  if (sameOwner(session.sourceOwner, target.owner)) {
    const nextRoot = movePaneToTarget(
      ownerRoot(session.sourceOwner),
      session.sourcePaneId,
      target.paneId,
      target.zone,
      id,
    );
    commitWorkspacePaneMutations(windowManager, dockManager, [
      { owner: session.sourceOwner, rootPane: nextRoot },
    ]);
    return;
  }
  if (
    session.sourceOwner.kind === "dock" &&
    ownerRoot(session.sourceOwner).id === session.sourcePaneId
  )
    return;
  const result = relocatePaneBetweenTrees(
    ownerRoot(session.sourceOwner),
    session.sourcePaneId,
    ownerRoot(target.owner),
    target.paneId,
    target.zone,
    id,
  );
  commitWorkspacePaneMutations(windowManager, dockManager, [
    { owner: session.sourceOwner, rootPane: result.sourceRoot },
    { owner: target.owner, rootPane: result.targetRoot },
  ]);
}

function finishPaneDrag(): void {
  disposePaneDrag?.();
}
function finishTabReorder(): void {
  disposeTabReorder?.();
}
function pointerEditAllowed(event: PointerEvent): boolean {
  return (
    editState.value.editActive ||
    (editState.value.mode === "normal" && event.ctrlKey)
  );
}

function paneDragSourceFromTarget(
  target: HTMLElement,
  clientX: number,
  clientY: number,
): {
  owner: WorkspacePaneOwner;
  sourcePaneId: string;
  sourceTabPaneId?: string;
  sourceElement: HTMLElement;
  captureTarget: HTMLElement;
} | null {
  const layer = target.closest<HTMLElement>('[data-layout-edit-interaction-layer]');
  const frame = layer?.closest<HTMLElement>('.wf-window-frame[data-window-instance-id]');
  const pane = target.closest<HTMLElement>(".wf-pane-host[data-pane-id]") ??
    (frame?.dataset.windowInstanceId ? paneAtPoint(frame.dataset.windowInstanceId, clientX, clientY) : null);
  if (!pane?.dataset.paneId) return null;
  const owner = ownerFromElement(pane);
  if (!owner) return null;
  const tab = target.closest<HTMLElement>("[data-tab-pane-id]");
  const tabHost = tab?.closest<HTMLElement>(
    '.wf-pane-host[data-pane-kind="tabs"]',
  );
  const sourcePaneId = tab?.dataset.tabPaneId ?? pane.dataset.paneId;
  const sourceTabPaneId = tabHost?.dataset.paneId;
  return {
    owner,
    sourcePaneId,
    ...(sourceTabPaneId ? { sourceTabPaneId } : {}),
    sourceElement: tab ?? pane,
    captureTarget: layer ?? pane,
  };
}

function startPaneDrag(event: PointerEvent): void {
  if (layoutLocked.value || !pointerEditAllowed(event) || event.button !== 0)
    return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const source = paneDragSourceFromTarget(target, event.clientX, event.clientY);
  if (!source || target.closest('[data-tab-drag-disabled="true"]')) return;
  const sourceRoot = ownerRoot(source.owner);
  if (
    !findPane(sourceRoot, source.sourcePaneId) ||
    !paneDragAllowed(source.owner, source.sourcePaneId) ||
    (source.sourceTabPaneId &&
      !paneDragAllowed(source.owner, source.sourceTabPaneId)) ||
    (source.owner.kind === "dock" && sourceRoot.id === source.sourcePaneId)
  )
    return;
  finishPaneDrag();
  finishTabReorder();
  editController.selectPane({
    owner: source.owner,
    paneId: source.sourcePaneId,
  });
  const pointerId =
    typeof event.pointerId === "number" ? event.pointerId : undefined;
  const session: PaneDragSession = {
    sourceOwner: source.owner,
    sourcePaneId: source.sourcePaneId,
    ...(source.sourceTabPaneId
      ? { sourceTabPaneId: source.sourceTabPaneId }
      : {}),
    sourceElement: source.sourceElement,
    captureTarget: source.captureTarget,
    pointerId,
    startX: event.clientX,
    startY: event.clientY,
    started: false,
  };
  if (
    pointerId !== undefined &&
    typeof source.captureTarget.setPointerCapture === "function"
  ) {
    try {
      source.captureTarget.setPointerCapture(pointerId);
    } catch {
      /* optional */
    }
  }
  const matches = (next: PointerEvent): boolean =>
    pointerId === undefined ||
    typeof next.pointerId !== "number" ||
    next.pointerId === pointerId;
  const move = (next: PointerEvent): void => {
    if (!matches(next)) return;
    if (
      !session.started &&
      Math.hypot(next.clientX - session.startX, next.clientY - session.startY) <
        4
    )
      return;
    if (!session.started) {
      session.started = true;
      paneDragActive.value = true;
      suppressClick = true;
    }
    next.preventDefault();
    next.stopPropagation();
    paneDropPreview.value =
      findDropTarget(session, next.clientX, next.clientY) ??
      findDetachTarget(session, next.clientX, next.clientY);
  };
  const cleanup = (): void => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
    source.captureTarget.removeEventListener("lostpointercapture", lost);
    if (
      pointerId !== undefined &&
      typeof source.captureTarget.releasePointerCapture === "function"
    ) {
      try {
        source.captureTarget.releasePointerCapture(pointerId);
      } catch {
        /* optional */
      }
    }
    paneDropPreview.value = null;
    paneDragActive.value = false;
    if (disposePaneDrag === cleanup) disposePaneDrag = null;
  };
  const end = (next: PointerEvent): void => {
    if (!matches(next)) return;
    const drop = paneDropPreview.value;
    if (next.type === "pointerup" && session.started && drop) {
      try {
        if (drop.kind === "detach") commitPaneDetach(session, drop);
        else commitPaneDrop(session, drop);
      } catch {
        history?.cancelTransaction();
      }
    }
    cleanup();
  };
  const lost = (): void => cleanup();
  disposePaneDrag = cleanup;
  source.captureTarget.addEventListener("lostpointercapture", lost);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
}

function tabReorderPreviewFor(
  session: TabReorderSession,
  x: number,
  y: number,
): TabReorderPreview | null {
  const tabbar = session.sourceElement.closest<HTMLElement>(
    ".wf-pane-host__tabbar",
  );
  if (!tabbar || !containsPoint(tabbar.getBoundingClientRect(), x, y))
    return null;
  const elements = [
    ...tabbar.querySelectorAll<HTMLElement>("[data-tab-pane-id]"),
  ];
  const items = elements.filter(
    (element) => element.closest(".wf-pane-host__tabbar") === tabbar,
  );
  if (items.length === 0) return null;
  const rects = items.map((element) => element.getBoundingClientRect());
  let slot = items.length;
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index];
    if (rect && x < rect.left + rect.width / 2) {
      slot = index;
      break;
    }
  }
  const tabbarRect = tabbar.getBoundingClientRect();
  const markerX =
    slot === items.length
      ? (rects.at(-1)?.right ?? tabbarRect.right)
      : (rects[slot]?.left ?? tabbarRect.left);
  const targetIndex = Math.max(
    0,
    Math.min(items.length - 1, session.sourceIndex < slot ? slot - 1 : slot),
  );
  return {
    owner: session.sourceOwner,
    tabPaneId: session.tabPaneId,
    targetIndex,
    rect: {
      x: markerX - 1,
      y: tabbarRect.top,
      width: 2,
      height: tabbarRect.height,
    },
  };
}

function commitTabReorder(
  session: TabReorderSession,
  preview: TabReorderPreview,
): void {
  if (
    layoutLocked.value ||
    !sameOwner(session.sourceOwner, preview.owner) ||
    session.tabPaneId !== preview.tabPaneId ||
    session.sourceIndex === preview.targetIndex
  )
    return;
  const nextRoot = reorderTab(
    ownerRoot(session.sourceOwner),
    session.tabPaneId,
    session.sourceTabId,
    preview.targetIndex,
  );
  commitWorkspacePaneMutations(windowManager, dockManager, [
    { owner: session.sourceOwner, rootPane: nextRoot },
  ]);
}

function startTabReorder(event: PointerEvent): void {
  if (layoutLocked.value || editMode.value || event.button !== 0) return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const handle = target.closest<HTMLElement>("[data-tab-drag-handle]");
  const tab = handle?.closest<HTMLElement>("[data-tab-pane-id]");
  const tabHost = handle?.closest<HTMLElement>(
    '.wf-pane-host[data-pane-kind="tabs"]',
  );
  const tabPaneId = tabHost?.dataset.paneId;
  const sourceTabId = tab?.dataset.tabPaneId;
  if (
    !handle ||
    handle.dataset.tabDragDisabled === "true" ||
    !tab ||
    !tabHost ||
    !tabPaneId ||
    !sourceTabId
  )
    return;
  const owner = ownerFromElement(tabHost);
  if (!owner) return;
  const pane = findPane(ownerRoot(owner), tabPaneId);
  if (
    !pane ||
    pane.kind !== "tabs" ||
    !pane.children.some((child) => child.id === sourceTabId) ||
    !paneDragAllowed(owner, tabPaneId)
  )
    return;
  const sourceIndex = pane.children.findIndex(
    (child) => child.id === sourceTabId,
  );
  if (sourceIndex < 0) return;
  event.preventDefault();
  event.stopPropagation();
  finishTabReorder();
  finishPaneDrag();
  const pointerId =
    typeof event.pointerId === "number" ? event.pointerId : undefined;
  const session: TabReorderSession = {
    sourceOwner: owner,
    tabPaneId,
    sourceTabId,
    sourceIndex,
    sourceElement: tab,
    captureTarget: handle,
    pointerId,
    startX: event.clientX,
    startY: event.clientY,
    started: false,
  };
  if (
    pointerId !== undefined &&
    typeof handle.setPointerCapture === "function"
  ) {
    try {
      handle.setPointerCapture(pointerId);
    } catch {
      /* optional */
    }
  }
  const matches = (next: PointerEvent): boolean =>
    pointerId === undefined ||
    typeof next.pointerId !== "number" ||
    next.pointerId === pointerId;
  const move = (next: PointerEvent): void => {
    if (!matches(next)) return;
    if (
      !session.started &&
      Math.hypot(next.clientX - session.startX, next.clientY - session.startY) <
        4
    )
      return;
    session.started = true;
    tabReorderPreview.value = tabReorderPreviewFor(
      session,
      next.clientX,
      next.clientY,
    );
  };
  const cleanup = (): void => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
    handle.removeEventListener("lostpointercapture", lost);
    if (
      pointerId !== undefined &&
      typeof handle.releasePointerCapture === "function"
    ) {
      try {
        handle.releasePointerCapture(pointerId);
      } catch {
        /* optional */
      }
    }
    tabReorderPreview.value = null;
    if (disposeTabReorder === cleanup) disposeTabReorder = null;
  };
  const end = (next: PointerEvent): void => {
    if (!matches(next)) return;
    const preview = tabReorderPreview.value;
    if (next.type === "pointerup" && session.started && preview) {
      try {
        commitTabReorder(session, preview);
      } catch {
        history?.cancelTransaction();
      }
    }
    cleanup();
  };
  const lost = (): void => cleanup();
  disposeTabReorder = cleanup;
  handle.addEventListener("lostpointercapture", lost);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
}

function selectFromPointer(event: PointerEvent): void {
  if (!editState.value.editActive || layoutLocked.value) return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const resizeHandle = target.closest<HTMLElement>('[data-window-layout-resize-handle]');
  if (resizeHandle?.dataset.windowLayoutResizeSource) {
    editController.selectWindow(resizeHandle.dataset.windowLayoutResizeSource);
    return;
  }
  const constraintHandle = target.closest<HTMLElement>('[data-window-constraint-handle]');
  if (constraintHandle?.dataset.windowConstraintSource) {
    editController.selectWindow(constraintHandle.dataset.windowConstraintSource);
    return;
  }
  const dockElement = target.closest<HTMLElement>('[data-dock-id]');
  if (dockElement?.dataset.dockId && !target.closest('.wf-pane-host')) {
    editController.selectDock(dockElement.dataset.dockId);
    return;
  }
  const frame = target.closest<HTMLElement>('.wf-window-frame[data-window-instance-id]');
  const windowId = frame?.dataset.windowInstanceId;
  const windowState = windowId ? windowStates.value.find((window) => window.instanceId === windowId) : undefined;
  const interactionLayer = target.closest('[data-layout-edit-interaction-layer]');
  const layerPane = interactionLayer && windowId ? paneAtPoint(windowId, event.clientX, event.clientY) : null;
  const pane = layerPane ?? target.closest<HTMLElement>(".wf-pane-host[data-pane-id]");
  if (windowState?.layoutLocked && windowId && !pane) {
    editController.selectWindow(windowId);
    return;
  }
  if (!pane && windowId) {
    editController.selectWindow(windowId);
    return;
  }
  if (!pane?.dataset.paneId) return;
  const selection = selectionFor(pane, pane.dataset.paneId);
  if (selection) editController.selectPane(selection);
}
function selectFromFocus(event: FocusEvent): void {
  if (!editState.value.editActive || layoutLocked.value) return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const frame = target.closest<HTMLElement>('.wf-window-frame[data-window-instance-id]');
  const windowId = frame?.dataset.windowInstanceId;
  if (!windowId || target !== frame) return;
  editController.selectWindow(windowId);
}
function pointerSessionKind(event: PointerEvent): PointerSessionKind | null {
  const target = event.target;
  if (
    !(target instanceof HTMLElement) ||
    event.button !== 0 ||
    layoutLocked.value
  )
    return null;
  if (target.closest('[data-window-layout-resize-handle]')) return null;
  if (target.closest('[data-window-constraint-handle]')) return null;
  if (target.closest("[data-pane-divider-index]")) return "pane-resize";
  if (target.closest("[data-dock-resize]")) return "dock-resize";
  if (target.closest('[data-layout-edit-interaction-layer]')) return "pane-drag";
  if (target.closest("[data-window-resize-handle]")) return "window-resize";
  if (target.closest("[data-window-drag-handle]")) return "window-drag";
  const tabHandle = target.closest<HTMLElement>("[data-tab-drag-handle]");
  if (tabHandle) {
    if (tabHandle.dataset.tabDragDisabled === "true") return null;
    if (pointerEditAllowed(event)) return "pane-drag";
    if (!editMode.value) return "tab-reorder";
  }
  if (
    pointerEditAllowed(event) &&
    target.closest(".wf-pane-host[data-pane-id]")
  )
    return "pane-drag";
  return null;
}
function matchesPointerSession(event: PointerEvent): boolean {
  const session = pointerSession;
  return Boolean(
    session &&
    (session.pointerId === undefined ||
      typeof event.pointerId !== "number" ||
      session.pointerId === event.pointerId),
  );
}
function handlePointerDown(event: PointerEvent): void {
  if (pointerSession && !matchesPointerSession(event)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  selectFromPointer(event);
  const kind = pointerSessionKind(event);
  if (!kind) return;
  if (!pointerSession) {
    pointerSession = {
      kind,
      pointerId:
        typeof event.pointerId === "number" ? event.pointerId : undefined,
    };
    history?.beginTransaction();
  }
  if (kind === "pane-drag") startPaneDrag(event);
  if (kind === "tab-reorder") startTabReorder(event);
}
function finishHistoryPointer(
  action: "commit" | "cancel",
  event?: PointerEvent,
): void {
  if (!pointerSession || (event && !matchesPointerSession(event))) return;
  pointerSession = null;
  if (action === "cancel") {
    history?.cancelTransaction();
    return;
  }
  const activeHistory = history;
  queueMicrotask(() => activeHistory?.commitTransaction());
}
function openLayoutDialog(instanceId: string): void {
  layoutDialogWindow.value = windowManager.get(instanceId);
  contextMenu.close();
}
function toggleEditMode(): void {
  if (editState.value.mode === 'locked') return
  editController.setMode(editState.value.mode === 'edit' ? 'normal' : 'edit')
}
function resetEditTransients(): void {
  cancelInspectorEdit();
  finishLayoutResize();
  finishConstraintLink();
  keyboardConstraintEdge.value = null;
  selectedConstraint.value = null;
  finishPaneDrag();
  finishTabReorder();
  paneDropPreview.value = null;
  tabReorderPreview.value = null;
  layoutPreview.value = null;
  layoutDialogWindow.value = null;
  contextMenu.close();
  finishHistoryPointer('cancel');
}
function closeLayoutDialog(): void {
  layoutPreview.value = null;
  layoutDialogWindow.value = null;
}
function previewRectStyle(preview: WindowLayoutDialogPreview): Record<string, string> {
  return {
    left: `${layout.value.floating.x + preview.geometry.position.x}px`,
    top: `${layout.value.floating.y + preview.geometry.position.y}px`,
    width: `${preview.geometry.size.width}px`,
    height: `${preview.geometry.size.height}px`,
  };
}
function updateLayoutPreview(preview: WindowLayoutDialogPreview | null): void {
  layoutPreview.value = preview;
}
function beginInspectorEdit(): void {
  if (inspectorTransactionActive.value) return;
  history?.beginTransaction();
  inspectorTransactionActive.value = true;
}
function cancelInspectorEdit(): void {
  if (!inspectorTransactionActive.value) return;
  history?.cancelTransaction();
  inspectorTransactionActive.value = false;
  layoutPreview.value = null;
}
function applyInspectorStyle(style: LayoutSurfaceStyle | undefined): void {
  const selection = inspectorSelection.value;
  if (!selection) return;
  if (selection.kind === 'window') {
    windowManager.setOptions(selection.id, { surfaceStyle: style }, 'user');
    return;
  }
  if (selection.kind === 'dock') {
    dockManager.setSurfaceStyle(selection.id, style);
    return;
  }
  const owner = selection.ownerKind && selection.ownerId ? { kind: selection.ownerKind, id: selection.ownerId } as WorkspacePaneOwner : null;
  if (!owner) return;
  setOwnerRoot(owner, setPaneSurfaceStyle(ownerRoot(owner), selection.id, style));
}
function previewInspectorStyle(style: LayoutSurfaceStyle | undefined): void {
  if (!inspectorTransactionActive.value) beginInspectorEdit();
  try { applyInspectorStyle(style) } catch { cancelInspectorEdit() }
}
function commitInspectorStyle(style: LayoutSurfaceStyle | undefined): void {
  try {
    applyInspectorStyle(style);
    if (inspectorTransactionActive.value) {
      history?.commitTransaction();
      inspectorTransactionActive.value = false;
    }
  } catch { cancelInspectorEdit() }
}
function updateInspectorMode(mode: LayoutInspectorMode): void {
  inspectorMode.value = mode;
}
function updateInspectorFloatingPosition(position: LayoutInspectorFloatingPosition): void {
  inspectorFloatingPosition.value = position;
}
function focusWindowShell(instanceId: string): void {
  void nextTick(() => {
    const frame = [...(root.value?.querySelectorAll<HTMLElement>('.wf-window-frame[data-window-instance-id]') ?? [])].find((element) => element.dataset.windowInstanceId === instanceId);
    frame?.querySelector<HTMLElement>('.wf-window-shell')?.focus();
  });
}
function lockSelectedWindow(instanceId: string): void {
  if (layoutLocked.value) return;
  try {
    windowManager.lockWindow(instanceId, 'user');
  } catch {
    return;
  }
}
function unlockSelectedWindow(instanceId: string): void {
  if (layoutLocked.value) return;
  try {
    windowManager.unlockWindow(instanceId, 'user');
  } catch {
    return;
  }
  editController.selectWindow(null);
  editController.selectPane(null);
  focusWindowShell(instanceId);
}
function applyLayoutDialog(value: WindowLayoutDialogSave): void {
  const window = layoutDialogWindow.value;
  const selected = selectedWindow.value;
  const target = window ?? selected;
  const preserveInspectorSelection = window === null && inspectorTransactionActive.value;
  if (!target) return;
  layoutPreview.value = null;
  try {
    const container = windowManager.getResponsiveContainer() ?? floatingSize.value;
    if (value.layoutSpec) windowManager.setLayoutSpec(target.instanceId, value.layoutSpec, container, 'user', preserveInspectorSelection ? 'active' : target.layoutSpecState);
    else if (target.layoutLocked) windowManager.setLayoutSpec(target.instanceId, createAbsoluteWindowLayoutSpec(value.geometry), container, 'user', 'materialized');
    else windowManager.setGeometry(target.instanceId, value.geometry, 'user');
    if (inspectorTransactionActive.value) {
      history?.commitTransaction();
      inspectorTransactionActive.value = false;
    }
  } catch {
    cancelInspectorEdit();
    return;
  }
  layoutDialogWindow.value = null;
  if (!preserveInspectorSelection) editController.selectPane(null);
}
function executePaneMenu(
  item: ContextMenuItem,
  selection: WorkspacePaneSelection,
): void {
  if (layoutLocked.value) return;
  if (item.id === "layout-window" && selection.owner.kind === "window") {
    openLayoutDialog(selection.owner.id);
    return;
  }
  if (item.id === "lock-window" && selection.owner.kind === "window") {
    windowManager.lockWindow(selection.owner.id, "user");
    editController.selectPane(null);
    return;
  }
  if (item.id === "unlock-window" && selection.owner.kind === "window") {
    windowManager.unlockWindow(selection.owner.id, "user");
    editController.selectPane(null);
    return;
  }
  if (item.id === "lock") {
    editController.setPaneLocked(selection, true);
    return;
  }
  if (item.id === "unlock") {
    editController.setPaneLocked(selection, false);
    return;
  }
  if (item.id === "detach-dock" && selection.owner.kind === "dock") {
    try {
      detachDock(selection.owner.id);
      editController.selectPane(null);
    } catch {
      history?.cancelTransaction();
    }
    return;
  }
  if (item.id === "delete") {
    const next = removePaneForEdit(
      ownerRoot(selection.owner),
      selection.paneId,
    );
    if (next) setOwnerRoot(selection.owner, next);
    editController.selectPane(null);
    return;
  }
  emit("paneAction", item.id as PaneEditActionId, selection);
}
function openPaneMenu(event: MouseEvent): void {
  if (!editState.value.editActive || layoutLocked.value) return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const pane = target.closest<HTMLElement>(".wf-pane-host[data-pane-id]");
  if (!pane?.dataset.paneId) return;
  const selection = selectionFor(pane, pane.dataset.paneId);
  if (!selection) return;
  const windowState = selection.owner.kind === "window" ? windowManager.get(selection.owner.id) : null;
  const items = windowState?.layoutLocked
    ? [{ id: "unlock-window", label: "Unlock window" }, { id: "layout-window", label: "Layout…" }]
    : [...(windowState?.mode === "normal" ? [{ id: "lock-window", label: "Lock window" }] : []), ...(windowState ? [{ id: "layout-window", label: "Layout…" }] : []), ...createPaneEditContextMenuItems(
      ownerRoot(selection.owner),
      selection.paneId,
      editController.isPaneLocked(selection),
    ), ...(selection.owner.kind === "dock" && ownerRoot(selection.owner).id === selection.paneId ? [{ id: "detach-dock", label: "Detach dock to window" }] : [])];
  if (items.length === 0) return;
  event.preventDefault();
  editController.selectPane(selection);
  contextMenu.show({
    x: event.clientX,
    y: event.clientY,
    items,
    onSelect: (item) => executePaneMenu(item, selection),
  });
}
function onWorkspaceKeyDown(event: KeyboardEvent): void {
  if (history)
    handleWorkspaceHistoryShortcut(
      history,
      event,
      props.historyShortcuts !== false,
    );
}
function onGlobalKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    finishLayoutResize();
    finishConstraintLink();
    finishPaneDrag();
    finishTabReorder();
    paneDropPreview.value = null;
    tabReorderPreview.value = null;
    contextMenu.close();
    finishHistoryPointer("cancel");
    return;
  }
  if (event.key === "Control" && !pointerSession)
    editController.setTemporaryEdit(true);
}
function onKeyUp(event: KeyboardEvent): void {
  if (event.key === "Control") editController.setTemporaryEdit(false);
}
function onBlur(): void {
  finishLayoutResize();
  finishConstraintLink();
  editController.setTemporaryEdit(false);
  finishPaneDrag();
  finishTabReorder();
  suppressClick = false;
  finishHistoryPointer("cancel");
}
function onPointerUp(event: PointerEvent): void {
  finishHistoryPointer("commit", event);
}
function onPointerCancel(event: PointerEvent): void {
  finishHistoryPointer("cancel", event);
}
function onLostPointerCapture(event: PointerEvent): void {
  finishPaneDrag();
  finishTabReorder();
  finishHistoryPointer("cancel", event);
}
function onWorkspaceClick(event: MouseEvent): void {
  if (!suppressClick) return;
  suppressClick = false;
  event.preventDefault();
  event.stopPropagation();
}
onMounted(() => {
  if (root.value) {
    disposeSize = observeElementSize(root.value, (next) => {
      size.value = next;
    });
    root.value.addEventListener("keydown", onWorkspaceKeyDown);
    queueMicrotask(syncEditMarkers);
  }
  window.addEventListener("keydown", onGlobalKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("lostpointercapture", onLostPointerCapture);
});
onBeforeUnmount(() => {
  finishLayoutResize();
  finishConstraintLink();
  finishPaneDrag();
  finishTabReorder();
  finishHistoryPointer("cancel");
  disposeSize?.();
  disposeSize = null;
  unsubscribeDock();
  unsubscribeWindow();
  unsubscribeEdit();
  root.value?.removeEventListener("keydown", onWorkspaceKeyDown);
  window.removeEventListener("keydown", onGlobalKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("blur", onBlur);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerCancel);
  window.removeEventListener("lostpointercapture", onLostPointerCapture);
});
</script>

<template>
  <div
    ref="root"
    class="wf-workspace-host"
    :class="{
      'wf-workspace-host--edit': editMode,
      'wf-workspace-host--locked': layoutLocked,
    }"
    :data-workspace-mode="editState.mode"
    :data-workspace-edit-mode="editMode"
    :data-workspace-locked="layoutLocked"
    :data-tab-reorder-active="tabReorderPreview ? 'true' : undefined"
    @pointerdown.capture="handlePointerDown"
    @focusin.capture="selectFromFocus"
    @click.capture="onWorkspaceClick"
    @contextmenu.capture="openPaneMenu"
  >
    <div class="wf-workspace-edit-chrome" data-workspace-edit-chrome role="toolbar" aria-label="Layout editor controls">
      <span v-if="editState.mode === 'edit'" class="wf-workspace-edit-status" data-workspace-edit-status role="status">Layout editing</span>
      <button class="wf-workspace-edit-toggle" type="button" data-workspace-edit-toggle :aria-label="editState.mode === 'edit' ? 'Exit layout edit mode' : 'Edit layout'" :aria-pressed="editState.mode === 'edit' ? 'true' : 'false'" @click="toggleEditMode">
        <WfIcon :name="editState.mode === 'edit' ? 'check' : 'edit'" />
        <span>{{ editState.mode === 'edit' ? 'Done' : 'Edit layout' }}</span>
      </button>
    </div>
    <div v-if="editMode && selectedWindow" class="wf-window-constraint-handles" data-window-constraint-handles aria-label="Window constraint handles">
      <button v-for="edge in constraintEdges" :key="edge" class="wf-window-constraint-handle" :style="constraintHandleStyle(edge)" :data-window-constraint-handle="edge" :data-window-constraint-source="selectedWindow.instanceId" :aria-label="`Connect ${edge} edge`" type="button" @pointerdown="startConstraintLink($event, edge)" @click.stop="startConstraintKeyboardSelection(edge)"><WfIcon name="link" /></button>
    </div>
    <div v-if="editMode && selectedWindow && selectedWindow.options.resizable" class="wf-window-layout-resize-handles" data-window-layout-resize-handles aria-label="Window resize zones">
      <div v-for="handle in layoutResizeHandles" :key="handle" class="wf-window-layout-resize-handle" :class="`wf-window-layout-resize-handle--${handle}`" :style="layoutResizeHandleStyle(handle)" :data-window-layout-resize-handle="handle" :data-window-layout-resize-source="selectedWindow.instanceId" :aria-label="`Resize ${handle}`" aria-hidden="true" @pointerdown="startLayoutResize($event, handle)" />
    </div>
    <div v-if="keyboardConstraintEdge" class="wf-window-constraint-keyboard-picker" data-window-constraint-keyboard-picker role="listbox" aria-label="Choose a constraint target">
      <strong>Connect {{ keyboardConstraintEdge }} edge</strong>
      <button v-for="option in constraintKeyboardOptions" :key="option.label" type="button" role="option" :aria-label="`Connect to ${option.label}`" @click="commitKeyboardConstraint(option)">{{ option.label }}</button>
      <button type="button" class="wf-window-constraint-keyboard-picker__cancel" @click="keyboardConstraintEdge = null">Cancel</button>
    </div>
    <svg v-if="editMode && (layoutRelations.length || constraintLinkLine())" class="wf-window-layout-relations" :width="size.width" :height="size.height" :viewBox="`0 0 ${Math.max(1, size.width)} ${Math.max(1, size.height)}`" data-window-layout-relations>
      <line v-for="(relation, index) in layoutRelations" :key="`${relation.sourceId}-${relation.targetId}-${index}`" :class="{ 'wf-window-layout-relation--selected': selectedConstraint?.sourceInstanceId === relation.sourceId && selectedConstraint?.sourceEdge === relation.sourceEdge && selectedConstraint?.targetId === relation.targetId && selectedConstraint?.targetEdge === relation.targetEdge }" :x1="relation.x1" :y1="relation.y1" :x2="relation.x2" :y2="relation.y2" data-window-layout-relation role="button" tabindex="0" :aria-label="`Select constraint ${relation.sourceEdge} to ${relation.targetId} ${relation.targetEdge}`" @click.stop="selectConstraint(relation)" @keydown.enter.prevent="selectConstraint(relation)" @keydown.space.prevent="selectConstraint(relation)" />
      <line v-if="constraintLinkLine()" class="wf-window-layout-relation--active" :x1="constraintLinkLine()?.x1" :y1="constraintLinkLine()?.y1" :x2="constraintLinkLine()?.x2" :y2="constraintLinkLine()?.y2" data-window-constraint-drag-line />
    </svg>
    <button v-if="selectedConstraint && selectedConstraintLabel" class="wf-window-constraint-remove" data-window-constraint-remove type="button" :aria-label="`Remove constraint ${selectedConstraintLabel}`" @click="removeSelectedConstraint">Remove {{ selectedConstraintLabel }}</button>
    <LayoutInspector
      v-if="editMode"
      :window="selectedWindow"
      :windows="windowStates"
      :selection="inspectorSelection"
      :docks="dockStates"
      :container="floatingSize"
      :surface="selectedWindowStatus?.surface"
      :rule="selectedWindowStatus?.rule"
      :selected-constraint-edge="selectedConstraint?.sourceInstanceId === selectedWindow?.instanceId ? selectedConstraint?.sourceEdge ?? null : null"
      :mode="inspectorMode"
      :floating-position="inspectorFloatingPosition"
      @lock="lockSelectedWindow"
      @unlock="unlockSelectedWindow"
      @layout="openLayoutDialog"
      @preview="updateLayoutPreview"
      @save="applyLayoutDialog"
      @edit-start="beginInspectorEdit"
      @cancel="cancelInspectorEdit"
      @constraint-select="selectInspectorConstraint"
      @mode-change="updateInspectorMode"
      @floating-position-change="updateInspectorFloatingPosition"
      @style-edit-start="beginInspectorEdit"
      @style-preview="previewInspectorStyle"
      @style-save="commitInspectorStyle"
      @style-cancel="cancelInspectorEdit"
    />
    <div
      class="wf-workspace-host__floating"
      :style="rectStyle(layout.floating)"
      data-workspace-floating
    >
      <WindowManagerHost
        :manager="windowManager"
        :registry="registry"
        :commands="props.commands"
        :launcher-placeholder="props.launcherPlaceholder"
        :launcher-submit-label="props.launcherSubmitLabel"
        :layout-locked="layoutLocked"
        :edit-mode="editMode"
        :pane-drag-enabled="windowPaneDragEnabled"
      />
    </div>
    <div
      v-if="layoutPreview"
      class="wf-window-layout-preview"
      data-layout-preview-overlay
      :style="previewRectStyle(layoutPreview)"
      aria-hidden="true"
    />
    <div v-if="constraintLink?.target" class="wf-window-constraint-target" data-window-constraint-target :data-window-constraint-target-id="constraintLink.target.targetInstanceId ?? 'workspace'" :data-window-constraint-target-edge="constraintLink.target.edge" :style="constraintTargetMarkerStyle(constraintLink.target)" aria-hidden="true" />
    <div v-if="constraintGhostStyle()" class="wf-window-constraint-ghost" data-window-constraint-ghost :style="constraintGhostStyle()" aria-hidden="true" />
    <DockHost
      v-for="dock in dockStates"
      :key="dock.id"
      :dock="dock"
      :rect="layout.docks[dock.id] ?? { x: 0, y: 0, width: 0, height: 0 }"
      :manager="dockManager"
      :registry="registry"
      :commands="props.commands"
      :layout-locked="layoutLocked"
      :edit-mode="editMode"
      :layout-selection="dockLayoutSelection(dock.id)"
      :pane-drag-enabled="(paneId) => dockPaneDragEnabled(dock.id, paneId)"
    />
    <div
      v-if="tabReorderPreview"
      class="wf-tab-reorder-indicator"
      data-tab-reorder-preview
      :style="tabReorderIndicatorStyle(tabReorderPreview)"
      aria-hidden="true"
    />
    <DockingOverlay
      v-if="paneDropPreview?.kind === 'pane' && !layoutLocked"
      :target-rect="localTargetRect(paneDropPreview)"
      :active-zone="paneDropPreview.zone"
      :source-id="paneDropPreview.owner.id"
      :target-id="paneDropPreview.paneId"
    />
    <div
      v-if="paneDropPreview?.kind === 'detach' && !layoutLocked"
      class="wf-pane-detach-preview"
      data-pane-detach-preview
      :style="rectStyle(localTargetRect(paneDropPreview))"
      aria-hidden="true"
    >
      New window
    </div>
    <ContextMenuHost :controller="contextMenu" />
    <WindowLayoutDialog
      v-if="layoutDialogWindow"
      :open="true"
      :window="layoutDialogWindow"
      :windows="windowManager.list()"
      :container="floatingSize"
      @cancel="closeLayoutDialog"
      @preview="updateLayoutPreview"
      @save="applyLayoutDialog"
    />
  </div>
</template>
<style scoped>
.wf-workspace-host {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--wf-color-canvas);
}
.wf-workspace-edit-chrome { position: absolute; top: var(--wf-space-sm); right: var(--wf-space-sm); z-index: var(--wf-layer-overlay); display: inline-flex; align-items: center; gap: var(--wf-space-xs); padding: var(--wf-space-2xs); border: 1px solid var(--wf-color-border-floating); border-radius: var(--wf-radius-sm); background: var(--wf-editor-panel-background); box-shadow: var(--wf-shadow-sm); }
.wf-workspace-edit-status { padding-inline: var(--wf-space-xs); color: var(--wf-color-accent); font-size: var(--wf-font-size-xs); font-weight: var(--wf-font-weight-bold); }
.wf-workspace-edit-toggle { display: inline-flex; min-height: var(--wf-size-control-height); align-items: center; gap: var(--wf-space-xs); padding: 0 var(--wf-space-sm); border: 1px solid var(--wf-color-border); border-radius: var(--wf-radius-sm); background: var(--wf-editor-panel-background); color: var(--wf-color-text); font: inherit; font-size: var(--wf-font-size-xs); cursor: pointer; }
.wf-workspace-edit-toggle:hover { background: var(--wf-color-hover); }
.wf-workspace-edit-toggle[aria-pressed="true"] { border-color: var(--wf-color-focus); background: var(--wf-color-selected); color: var(--wf-color-accent); }
.wf-workspace-edit-toggle:focus-visible { outline: 2px solid var(--wf-color-focus); outline-offset: 2px; }
.wf-window-layout-relations { position: absolute; inset: 0; z-index: 1; overflow: visible; pointer-events: none; }
.wf-window-layout-relations line { stroke: var(--wf-editor-constraint-color); stroke-width: 1.5; stroke-dasharray: 4 5; opacity: .48; pointer-events: stroke; cursor: pointer; vector-effect: non-scaling-stroke; transition: opacity 120ms ease, stroke-width 120ms ease; }
.wf-window-layout-relations line:focus-visible { stroke: var(--wf-color-focus); stroke-width: 4; outline: none; }
.wf-window-layout-relations .wf-window-layout-relation--selected { stroke: var(--wf-editor-selection-color); stroke-width: 2.5; stroke-dasharray: none; opacity: 1; }
.wf-window-layout-relations .wf-window-layout-relation--active { stroke: var(--wf-editor-constraint-color); stroke-width: 2; stroke-dasharray: 6 3; opacity: .95; }
.wf-window-constraint-handles { position: absolute; inset: 0; z-index: var(--wf-layer-overlay); pointer-events: none; }
.wf-window-constraint-handle { position: absolute; display: grid; width: var(--wf-editor-handle-size); height: var(--wf-editor-handle-size); transform: translate(-50%, -50%); place-items: center; padding: 0; border: 1px solid var(--wf-editor-constraint-color); border-radius: 50%; background: var(--wf-editor-panel-background); color: var(--wf-editor-constraint-color); font: inherit; font-size: var(--wf-size-icon-size); cursor: crosshair; pointer-events: auto; box-shadow: var(--wf-shadow-sm); transition: background 120ms ease, color 120ms ease, transform 120ms ease; }
.wf-window-constraint-handle:hover, .wf-window-constraint-handle:focus-visible { transform: translate(-50%, -50%) scale(1.08); background: var(--wf-color-selected); color: var(--wf-editor-selection-color); }
.wf-window-constraint-handle:focus-visible { outline: 2px solid var(--wf-color-focus); outline-offset: 2px; }
.wf-window-layout-resize-handles { position: absolute; inset: 0; z-index: calc(var(--wf-layer-overlay) - 1); pointer-events: none; }
.wf-window-layout-resize-handle { position: absolute; display: block; pointer-events: auto; background: transparent; touch-action: none; }
.wf-window-layout-resize-handle::after { content: ''; position: absolute; top: 50%; left: 50%; width: 8px; height: 8px; transform: translate(-50%, -50%) rotate(45deg); border: 1px solid var(--wf-editor-selection-color); border-radius: 2px; background: var(--wf-editor-panel-background); box-shadow: 0 0 0 2px color-mix(in srgb, var(--wf-editor-selection-color) 14%, transparent); pointer-events: none; }
.wf-window-layout-resize-handle--top::after, .wf-window-layout-resize-handle--bottom::after { width: 18px; height: 4px; transform: translate(-50%, -50%); border-radius: 3px; }
.wf-window-layout-resize-handle--left::after, .wf-window-layout-resize-handle--right::after { width: 4px; height: 18px; transform: translate(-50%, -50%); border-radius: 3px; }
.wf-window-layout-resize-handle--top, .wf-window-layout-resize-handle--bottom { cursor: ns-resize; }
.wf-window-layout-resize-handle--left, .wf-window-layout-resize-handle--right { cursor: ew-resize; }
.wf-window-layout-resize-handle--top-left, .wf-window-layout-resize-handle--bottom-right { cursor: nwse-resize; }
.wf-window-layout-resize-handle--top-right, .wf-window-layout-resize-handle--bottom-left { cursor: nesw-resize; }
.wf-window-layout-resize-handle:hover { background: var(--wf-color-selected); opacity: .55; }
.wf-window-constraint-keyboard-picker { position: absolute; top: calc(var(--wf-space-sm) + var(--wf-size-control-height) + var(--wf-space-xs)); right: var(--wf-space-sm); z-index: calc(var(--wf-layer-overlay) + 4); display: grid; min-width: 240px; max-width: min(320px, calc(100% - var(--wf-space-md))); gap: var(--wf-space-xs); padding: var(--wf-space-sm); border: 1px solid var(--wf-color-border-floating); border-radius: var(--wf-radius-md); background: var(--wf-color-surface-floating); box-shadow: var(--wf-shadow-md); color: var(--wf-color-text); }
.wf-window-constraint-keyboard-picker button { min-height: var(--wf-size-control-height-compact); padding: 0 var(--wf-space-sm); border: 1px solid var(--wf-color-border); border-radius: var(--wf-radius-sm); background: var(--wf-color-surface-raised); color: var(--wf-color-text); font: inherit; font-size: var(--wf-font-size-xs); text-align: left; cursor: pointer; }
.wf-window-constraint-keyboard-picker button:hover, .wf-window-constraint-keyboard-picker button:focus-visible { background: var(--wf-color-selected); border-color: var(--wf-color-focus); }
.wf-window-constraint-keyboard-picker button:focus-visible { outline: 2px solid var(--wf-color-focus); outline-offset: 1px; }
.wf-window-constraint-keyboard-picker__cancel { color: var(--wf-color-text-muted) !important; }
.wf-window-constraint-remove { position: absolute; top: calc(var(--wf-space-sm) + var(--wf-size-control-height) + var(--wf-space-xs)); left: var(--wf-space-sm); z-index: calc(var(--wf-layer-overlay) + 2); min-height: var(--wf-size-control-height-compact); max-width: min(320px, calc(100% - var(--wf-space-md))); padding: 0 var(--wf-space-sm); overflow: hidden; border: 1px solid var(--wf-color-border); border-radius: var(--wf-radius-sm); background: var(--wf-color-surface-floating); color: var(--wf-color-text); font: inherit; font-size: var(--wf-font-size-xs); text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.wf-window-constraint-remove:hover, .wf-window-constraint-remove:focus-visible { border-color: var(--wf-color-focus); background: var(--wf-color-selected); }
.wf-window-constraint-remove:focus-visible { outline: 2px solid var(--wf-color-focus); outline-offset: 2px; }
.wf-window-constraint-target { position: absolute; z-index: calc(var(--wf-layer-overlay) + 1); border-radius: var(--wf-radius-sm); background: var(--wf-editor-preview-color); box-shadow: 0 0 0 var(--wf-space-2xs) var(--wf-color-selected); pointer-events: none; }
.wf-window-constraint-ghost { position: absolute; z-index: calc(var(--wf-layer-overlay) - 1); border: 1px dashed var(--wf-editor-constraint-color); border-radius: var(--wf-radius-sm); background: color-mix(in srgb, var(--wf-editor-constraint-color) 8%, transparent); pointer-events: none; }
.wf-window-layout-preview { position: absolute; z-index: var(--wf-layer-overlay); border: 1px dashed var(--wf-editor-preview-color); border-radius: var(--wf-radius-sm); background: color-mix(in srgb, var(--wf-editor-preview-color) 10%, transparent); box-shadow: 0 0 0 1px var(--wf-editor-preview-color); pointer-events: none; }
.wf-workspace-host :deep([data-layout-picker-source]) { outline: 3px solid var(--wf-color-focus); outline-offset: 3px; }
.wf-workspace-host :deep([data-layout-picker-target]) { outline: 3px solid var(--wf-color-success); outline-offset: 3px; }
.wf-workspace-host__floating {
  position: absolute;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.wf-workspace-host--edit {
  --wf-editor-selection-outline: var(--wf-editor-selection-color);
  --wf-editor-hover-outline: var(--wf-editor-hover-color);
  --wf-editor-locked-outline: var(--wf-color-warning);
  background-image: radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--wf-editor-hover-color) 18%, transparent) 1px, transparent 1px);
  background-size: 20px 20px;
}
.wf-workspace-host--edit :deep(.wf-pane-host) {
  position: relative;
}
.wf-workspace-host--edit :deep(.wf-window-shell__content) {
  opacity: var(--wf-editor-content-opacity);
  filter: blur(var(--wf-editor-content-blur)) saturate(var(--wf-editor-content-saturation));
  transition: opacity 120ms ease, filter 120ms ease;
}
.wf-workspace-host--edit :deep(.wf-window-frame[data-layout-selection="unselected"]) {
  outline: 1px dashed var(--wf-color-border-floating);
  outline-offset: 1px;
}
.wf-workspace-host--edit :deep(.wf-window-frame:hover[data-layout-selection="unselected"]) {
  outline: 2px solid var(--wf-editor-hover-outline);
  outline-offset: 1px;
}
.wf-workspace-host--edit :deep(.wf-window-frame[data-layout-selection="selected"]) {
  outline: 2px solid var(--wf-editor-selection-outline);
  outline-offset: 3px;
  box-shadow: 0 0 0 1px var(--wf-editor-selection-outline), 0 0 0 4px color-mix(in srgb, var(--wf-editor-selection-outline) 18%, transparent);
}
.wf-workspace-host--edit :deep(.wf-window-frame:focus-visible) {
  outline: 2px solid var(--wf-editor-hover-outline);
  outline-offset: 3px;
}
.wf-workspace-host--edit :deep(.wf-pane-host[data-layout-selection="unselected"]) {
  outline: 1px dashed var(--wf-color-border-floating);
  outline-offset: -1px;
}
.wf-workspace-host--edit :deep(.wf-pane-host:hover[data-layout-selection="unselected"]) {
  outline: 2px solid var(--wf-editor-hover-outline);
  outline-offset: -2px;
}
.wf-workspace-host--edit :deep(.wf-pane-host[data-layout-selection="selected"]) {
  outline: 2px solid var(--wf-editor-selection-outline);
  outline-offset: -2px;
  box-shadow: 0 0 0 1px var(--wf-editor-selection-outline);
}
.wf-workspace-host--edit
  :deep(.wf-pane-host[data-pane-selected="true"]::before) {
  content: attr(data-pane-id);
  position: absolute;
  top: 2px;
  left: 2px;
  z-index: var(--wf-layer-overlay);
  padding: 1px var(--wf-space-xs);
  border-radius: var(--wf-radius-sm);
  background: var(--wf-color-surface-raised);
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-xs);
  pointer-events: none;
}
.wf-workspace-host--edit :deep([data-window-resize-handle]) { display: none; }
.wf-workspace-host--edit :deep(.wf-pane-host[data-pane-layout-locked="true"]) {
  outline-style: solid;
  outline-color: var(--wf-editor-locked-outline);
}
.wf-workspace-host--edit :deep(.wf-window-frame[data-window-layout-locked="true"][data-layout-selection="unselected"]) {
  outline: 1px solid var(--wf-editor-locked-outline);
  outline-offset: -1px;
}
.wf-workspace-host--edit :deep(.wf-dock-host[data-layout-selection="unselected"]) {
  outline: 1px dashed var(--wf-color-border-floating);
  outline-offset: 1px;
}
.wf-workspace-host--edit :deep(.wf-dock-host:hover[data-layout-selection="unselected"]) {
  outline: 2px solid var(--wf-editor-hover-outline);
  outline-offset: 1px;
}
.wf-workspace-host--edit :deep(.wf-dock-host[data-layout-selection="selected"]) {
  outline: 2px solid var(--wf-editor-selection-outline);
  outline-offset: 2px;
  box-shadow: 0 0 0 1px var(--wf-editor-selection-outline);
}
.wf-workspace-host--edit :deep([data-pane-divider-index]),
.wf-workspace-host--edit :deep([data-window-resize-handle]),
.wf-workspace-host--edit :deep([data-dock-resize]) {
  background: var(--wf-color-hover);
}
.wf-tab-reorder-indicator {
  position: absolute;
  z-index: var(--wf-layer-overlay);
  min-height: var(--wf-size-tab-height);
  pointer-events: none;
  background: var(--wf-color-focus);
  box-shadow: 0 0 0 1px var(--wf-color-border);
}
.wf-pane-detach-preview {
  position: absolute;
  z-index: var(--wf-layer-overlay);
  display: grid;
  place-items: center;
  border: 2px dashed var(--wf-color-focus);
  border-radius: var(--wf-radius-md);
  background: var(--wf-color-surface-floating);
  color: var(--wf-color-text-muted);
  box-shadow: var(--wf-shadow-md);
  pointer-events: none;
}
.wf-workspace-host--locked {
  cursor: default;
}
@media (prefers-reduced-motion: reduce) {
  .wf-workspace-host--edit :deep(.wf-window-shell__content),
  .wf-window-layout-relations line,
  .wf-window-constraint-handle { transition: none; }
}
</style>
