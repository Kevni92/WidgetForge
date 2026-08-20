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
  type DockPosition,
  type DockState,
} from "../core/dock-manager";
import {
  containsPane,
  findPane,
  removePane,
  reorderTab,
  type PaneNode,
} from "../core/pane";
import type { CommandRegistry } from "../core/commands";
import type { WidgetRegistry } from "../core/widget-registry";
import type { WindowSize } from "../core/window-geometry";
import type { WindowManager, WindowState } from "../core/window-manager";
import { createAbsoluteWindowLayoutSpec } from '../core/window-layout'
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
import type { WorkspaceHistory } from "../core/workspace-history";
import {
  detectWorkspaceDropZone,
  movePaneToTarget,
  relocatePaneBetweenTrees,
  anchorWindowToDock,
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
import WindowLayoutDialog, { type WindowLayoutDialogSave } from './WindowLayoutDialog.vue'
import WorkspaceSelectionActions from './WorkspaceSelectionActions.vue'
import { provideWidgetDocumentationForHost } from './documentation-context'

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
let disposeSize: (() => void) | null = null;
let disposePaneDrag: (() => void) | null = null;
let disposeTabReorder: (() => void) | null = null;
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
function anchorWindow(instanceId: string, position: DockPosition): void {
  if (layoutLocked.value) return;
  history?.beginTransaction();
  try {
    anchorWindowToDock(windowManager, dockManager, { instanceId, position });
    history?.commitTransaction();
  } catch {
    history?.cancelTransaction();
  }
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
    if (editController.isPaneLocked(selection))
      element.dataset.paneLayoutLocked = "true";
  }
  for (const element of workspace.querySelectorAll<HTMLElement>(
    ".wf-window-frame[data-window-instance-id]",
  )) {
    element.removeAttribute("data-window-selected");
    const instanceId = element.dataset.windowInstanceId;
    const selectedWindowId = editState.value.windowSelection?.instanceId ?? (editState.value.selection?.owner.kind === 'window' ? editState.value.selection.owner.id : null);
    if (
      instanceId &&
      selectedWindowId === instanceId
    )
      element.dataset.windowSelected = "true";
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
): {
  owner: WorkspacePaneOwner;
  sourcePaneId: string;
  sourceTabPaneId?: string;
  sourceElement: HTMLElement;
  captureTarget: HTMLElement;
} | null {
  const pane = target.closest<HTMLElement>(".wf-pane-host[data-pane-id]");
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
    captureTarget: pane,
  };
}

function startPaneDrag(event: PointerEvent): void {
  if (layoutLocked.value || !pointerEditAllowed(event) || event.button !== 0)
    return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const source = paneDragSourceFromTarget(target);
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
  const frame = target.closest<HTMLElement>('.wf-window-frame[data-window-instance-id]');
  const windowId = frame?.dataset.windowInstanceId;
  const windowState = windowId ? windowStates.value.find((window) => window.instanceId === windowId) : undefined;
  if (windowState?.layoutLocked && windowId) {
    editController.selectWindow(windowId);
    return;
  }
  const pane = target.closest<HTMLElement>(".wf-pane-host[data-pane-id]");
  if (!pane?.dataset.paneId) return;
  const selection = selectionFor(pane, pane.dataset.paneId);
  if (selection) editController.selectPane(selection);
}
function pointerSessionKind(event: PointerEvent): PointerSessionKind | null {
  const target = event.target;
  if (
    !(target instanceof HTMLElement) ||
    event.button !== 0 ||
    layoutLocked.value
  )
    return null;
  if (target.closest("[data-pane-divider-index]")) return "pane-resize";
  if (target.closest("[data-dock-resize]")) return "dock-resize";
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
function closeLayoutDialog(): void {
  layoutDialogWindow.value = null;
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
  if (!window) return;
  if (value.layoutSpec) windowManager.setLayoutSpec(window.instanceId, value.layoutSpec, floatingSize.value, 'user');
  else if (window.layoutLocked) windowManager.setLayoutSpec(window.instanceId, createAbsoluteWindowLayoutSpec(value.geometry), floatingSize.value, 'user');
  else windowManager.setGeometry(window.instanceId, value.geometry, 'user');
  layoutDialogWindow.value = null;
  editController.selectPane(null);
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
    @click.capture="onWorkspaceClick"
    @contextmenu.capture="openPaneMenu"
  >
    <WorkspaceSelectionActions
      v-if="editMode && selectedWindow"
      :instance-id="selectedWindow.instanceId"
      :title="selectedWindow.title"
      :locked="selectedWindow.layoutLocked"
      @lock="lockSelectedWindow"
      @unlock="unlockSelectedWindow"
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
        :anchor-window="anchorWindow"
      />
    </div>
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
.wf-workspace-host__floating {
  position: absolute;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.wf-workspace-host--edit :deep(.wf-pane-host) {
  position: relative;
  outline: 1px dashed var(--wf-color-border);
  outline-offset: -1px;
}
.wf-workspace-host--edit :deep(.wf-pane-host:hover) {
  outline-color: var(--wf-color-focus);
}
.wf-workspace-host--edit :deep(.wf-pane-host[data-pane-selected="true"]) {
  outline: 2px solid var(--wf-color-focus);
  outline-offset: -2px;
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
.wf-workspace-host--edit :deep(.wf-pane-host[data-pane-layout-locked="true"]) {
  outline-style: solid;
  outline-color: var(--wf-color-warning);
}
.wf-workspace-host--edit :deep(.wf-window-frame[data-window-layout-locked="true"]) {
  outline: 1px solid var(--wf-color-warning);
  outline-offset: -1px;
}
.wf-workspace-host--edit :deep(.wf-window-frame[data-window-selected="true"]) {
  outline: 2px solid var(--wf-color-focus);
  outline-offset: -2px;
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
</style>
