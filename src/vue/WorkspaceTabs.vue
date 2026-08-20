<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, type ComponentPublicInstance } from 'vue'
import ConfirmationDialog from './ConfirmationDialog.vue'
import { createWorkspaceEditController, type WorkspaceEditController, type WorkspaceEditState } from '../core/workspace-edit'
import type { WorkspaceCollectionManager, WorkspaceRuntime } from '../core/workspace-collection'

interface Props {
  manager: WorkspaceCollectionManager
  edit?: WorkspaceEditController | undefined
  layoutLocked?: boolean
  createLabel?: string | undefined
}

const props = withDefaults(defineProps<Props>(), {
  layoutLocked: false,
  createLabel: 'Create workspace',
})

const manager = toRaw(props.manager)
const edit = props.edit ? toRaw(props.edit) : createWorkspaceEditController()
const workspaces = shallowRef<readonly WorkspaceRuntime[]>(manager.list())
const activeWorkspaceId = shallowRef(manager.getActiveWorkspaceId())
const editState = shallowRef<WorkspaceEditState>(edit.state)
const renameId = ref<string | null>(null)
const renameDraft = ref('')
const pendingDelete = shallowRef<WorkspaceRuntime | null>(null)
const tabRefs = new Map<string, HTMLButtonElement>()
const inputRefs = new Map<string, HTMLInputElement>()

const manageAllowed = computed(() => !props.layoutLocked && !editState.value.locked)
const deleteAllowed = computed(() => manageAllowed.value && editState.value.editActive && workspaces.value.length > 1)
const deleteDialogTitle = computed(() => pendingDelete.value ? `Delete workspace "${pendingDelete.value.name}"?` : 'Delete workspace?')
const deleteDialogMessage = computed(() => pendingDelete.value ? 'This removes the workspace and all windows, docks, panes and widget state contained in it.' : '')

function setTabRef(id: string, element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLButtonElement) tabRefs.set(id, element)
  else tabRefs.delete(id)
}

function setInputRef(id: string, element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLInputElement) inputRefs.set(id, element)
  else inputRefs.delete(id)
}

function workspace(id: string): WorkspaceRuntime | undefined {
  return workspaces.value.find((candidate) => candidate.id === id)
}

function focusTab(id: string | null): void {
  if (!id) return
  void nextTick(() => tabRefs.get(id)?.focus())
}

function activateWorkspace(id: string): void {
  if (renameId.value && renameId.value !== id) commitRename()
  try {
    manager.activateWorkspace(id)
  } catch {
    return
  }
}

function startRename(id: string): void {
  if (!manageAllowed.value) return
  const candidate = workspace(id)
  if (!candidate) return
  renameId.value = id
  renameDraft.value = candidate.name
  void nextTick(() => {
    const input = inputRefs.get(id)
    input?.focus()
    input?.select()
  })
}

function finishRenameFocus(id: string | null): void {
  const target = id && workspace(id) ? id : activeWorkspaceId.value
  focusTab(target)
}

function cancelRename(): void {
  const id = renameId.value
  renameId.value = null
  renameDraft.value = ''
  finishRenameFocus(id)
}

function commitRename(): void {
  const id = renameId.value
  if (!id) return
  const name = renameDraft.value.trim()
  if (!name || !manageAllowed.value || !workspace(id)) {
    cancelRename()
    return
  }
  try {
    manager.renameWorkspace(id, name)
  } catch {
    cancelRename()
    return
  }
  renameId.value = null
  renameDraft.value = ''
  finishRenameFocus(id)
}

function onRenameKeydown(event: KeyboardEvent): void {
  event.stopPropagation()
  if (event.key === 'Enter') {
    event.preventDefault()
    commitRename()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelRename()
  }
}

function nextWorkspaceNumber(): number {
  const used = new Set(workspaces.value.map((candidate) => candidate.id))
  let number = workspaces.value.length + 1
  while (used.has(`workspace-${number}`)) number += 1
  return number
}

function createWorkspace(): void {
  if (!manageAllowed.value) return
  const number = nextWorkspaceNumber()
  const id = `workspace-${number}`
  try {
    manager.createWorkspace({ id, name: `Workspace ${number}`, activate: true })
  } catch {
    return
  }
  focusTab(id)
}

function requestDelete(id: string, event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  if (!deleteAllowed.value) return
  const candidate = workspace(id)
  if (candidate) pendingDelete.value = candidate
}

function closeDeleteDialog(): void {
  const id = pendingDelete.value?.id ?? null
  pendingDelete.value = null
  focusTab(id)
}

function confirmDelete(): void {
  const candidate = pendingDelete.value
  if (!candidate || !manageAllowed.value || manager.list().length <= 1) {
    closeDeleteDialog()
    return
  }
  try {
    manager.deleteWorkspace(candidate.id)
  } catch {
    pendingDelete.value = null
    focusTab(activeWorkspaceId.value)
    return
  }
  pendingDelete.value = null
  focusTab(activeWorkspaceId.value)
}

function moveFocus(id: string, offset: number): void {
  const index = workspaces.value.findIndex((candidate) => candidate.id === id)
  if (index < 0 || workspaces.value.length === 0) return
  const nextIndex = (index + offset + workspaces.value.length) % workspaces.value.length
  const next = workspaces.value[nextIndex]
  if (!next) return
  activateWorkspace(next.id)
  focusTab(next.id)
}

function onTabKeydown(event: KeyboardEvent, id: string): void {
  if (event.key === 'F2') {
    event.preventDefault()
    startRename(id)
    return
  }
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault()
    moveFocus(id, 1)
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault()
    moveFocus(id, -1)
  } else if (event.key === 'Home') {
    event.preventDefault()
    const first = workspaces.value[0]
    if (first) { activateWorkspace(first.id); focusTab(first.id) }
  } else if (event.key === 'End') {
    event.preventDefault()
    const last = workspaces.value.at(-1)
    if (last) { activateWorkspace(last.id); focusTab(last.id) }
  }
}

function onGlobalKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Control') edit.setTemporaryEdit(true)
}

function onGlobalKeyUp(event: KeyboardEvent): void {
  if (event.key === 'Control') edit.setTemporaryEdit(false)
}

function onGlobalBlur(): void {
  edit.setTemporaryEdit(false)
}

const unsubscribeCollection = manager.subscribe((change) => {
  workspaces.value = change.workspaces
  activeWorkspaceId.value = change.activeWorkspaceId
  if (renameId.value && !change.workspaces.some((candidate) => candidate.id === renameId.value)) cancelRename()
  if (pendingDelete.value && !change.workspaces.some((candidate) => candidate.id === pendingDelete.value?.id)) pendingDelete.value = null
})
const unsubscribeEdit = edit.subscribe((state) => { editState.value = state })

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeyDown)
  window.addEventListener('keyup', onGlobalKeyUp)
  window.addEventListener('blur', onGlobalBlur)
})

onBeforeUnmount(() => {
  unsubscribeCollection()
  unsubscribeEdit()
  window.removeEventListener('keydown', onGlobalKeyDown)
  window.removeEventListener('keyup', onGlobalKeyUp)
  window.removeEventListener('blur', onGlobalBlur)
})
</script>

<template>
  <nav class="wf-workspace-tabs" aria-label="Workspaces">
    <div class="wf-workspace-tabs__list" role="tablist" aria-orientation="horizontal">
      <div v-for="workspace in workspaces" :key="workspace.id" class="wf-workspace-tabs__item" role="presentation">
        <input
          v-if="renameId === workspace.id"
          :ref="(element) => setInputRef(workspace.id, element)"
          v-model="renameDraft"
          class="wf-workspace-tabs__rename"
          type="text"
          :aria-label="`Rename workspace ${workspace.name}`"
          @keydown="onRenameKeydown"
          @blur="commitRename"
        >
        <button
          v-else
          :ref="(element) => setTabRef(workspace.id, element)"
          type="button"
          role="tab"
          class="wf-workspace-tabs__tab"
          :class="{ 'wf-workspace-tabs__tab--active': workspace.id === activeWorkspaceId }"
          :data-workspace-tab="workspace.id"
          :aria-pressed="workspace.id === activeWorkspaceId"
          :aria-selected="workspace.id === activeWorkspaceId"
          :tabindex="workspace.id === activeWorkspaceId ? 0 : -1"
          @click="activateWorkspace(workspace.id)"
          @dblclick="startRename(workspace.id)"
          @keydown="onTabKeydown($event, workspace.id)"
        >{{ workspace.name }}</button>
        <button
          v-if="deleteAllowed"
          type="button"
          class="wf-workspace-tabs__delete"
          :data-workspace-delete="workspace.id"
          :aria-label="`Delete workspace ${workspace.name}`"
          @click="requestDelete(workspace.id, $event)"
        >−</button>
      </div>
      <button
        type="button"
        class="wf-workspace-tabs__add"
        data-workspace-add
        :aria-label="createLabel"
        :disabled="!manageAllowed"
        @click="createWorkspace"
      >+</button>
    </div>
    <div v-if="$slots.actions" class="wf-workspace-tabs__actions" data-workspace-tab-actions>
      <slot name="actions" />
    </div>
  </nav>

  <ConfirmationDialog
    :open="pendingDelete !== null"
    :title="deleteDialogTitle"
    :message="deleteDialogMessage"
    confirm-label="Delete workspace"
    cancel-label="Cancel"
    tone="danger"
    @confirm="confirmDelete"
    @cancel="closeDeleteDialog"
    @update:open="(open) => { if (!open) closeDeleteDialog() }"
  />
</template>

<style scoped>
.wf-workspace-tabs {
  display: flex;
  min-width: 0;
  min-height: var(--wf-size-tab-height);
  overflow: hidden;
  border-bottom: 1px solid var(--wf-color-border);
  background: var(--wf-color-surface-raised);
  scrollbar-width: thin;
}

.wf-workspace-tabs__list {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  overflow-x: auto;
  overflow-y: hidden;
  align-items: center;
  gap: var(--wf-space-2xs);
  padding: var(--wf-space-2xs) var(--wf-space-sm);
}

.wf-workspace-tabs__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--wf-space-xs);
  padding: var(--wf-space-2xs) var(--wf-space-sm);
  border-left: 1px solid var(--wf-color-border);
  background: var(--wf-color-surface-raised);
}

.wf-workspace-tabs__item {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  min-width: 0;
}

.wf-workspace-tabs__tab,
.wf-workspace-tabs__add,
.wf-workspace-tabs__delete {
  min-height: var(--wf-size-tab-height);
  border: 1px solid transparent;
  background: transparent;
  color: var(--wf-color-text-muted);
  font: inherit;
  font-size: var(--wf-font-size-xs);
  cursor: pointer;
}

.wf-workspace-tabs__tab {
  max-width: 240px;
  overflow: hidden;
  padding-inline: var(--wf-space-md);
  border-radius: var(--wf-radius-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wf-workspace-tabs__tab:hover,
.wf-workspace-tabs__add:hover,
.wf-workspace-tabs__delete:hover {
  background: var(--wf-color-hover);
  color: var(--wf-color-text);
}

.wf-workspace-tabs__tab--active {
  border-color: var(--wf-color-focus);
  background: var(--wf-color-selected);
  color: var(--wf-color-text);
}

.wf-workspace-tabs__tab:focus-visible,
.wf-workspace-tabs__add:focus-visible,
.wf-workspace-tabs__delete:focus-visible,
.wf-workspace-tabs__rename:focus-visible {
  outline: 2px solid var(--wf-color-focus);
  outline-offset: 1px;
}

.wf-workspace-tabs__add {
  flex: 0 0 auto;
  width: var(--wf-size-tab-height);
  border-radius: var(--wf-radius-sm);
  font-size: var(--wf-font-size-md);
}

.wf-workspace-tabs__add:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.wf-workspace-tabs__delete {
  width: var(--wf-size-icon-button-size);
  min-width: var(--wf-size-icon-button-size);
  border-radius: var(--wf-radius-sm);
  color: var(--wf-color-danger);
  font-size: var(--wf-font-size-md);
}

.wf-workspace-tabs__rename {
  width: min(240px, 24ch);
  min-height: var(--wf-size-tab-height);
  padding-inline: var(--wf-space-sm);
  border: 1px solid var(--wf-color-focus);
  border-radius: var(--wf-radius-sm);
  background: var(--wf-color-surface);
  color: var(--wf-color-text);
  font: inherit;
  font-size: var(--wf-font-size-xs);
}
</style>
