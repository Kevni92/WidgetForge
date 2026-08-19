<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, toRaw } from 'vue'
import type { WidgetRegistry } from '../core/widget-registry'
import type { WorkspaceCollectionManager, WorkspaceRuntime } from '../core/workspace-collection'
import WorkspaceHost from './WorkspaceHost.vue'

interface Props {
  manager: WorkspaceCollectionManager
  registry: WidgetRegistry
  layoutLocked?: boolean
}

const props = withDefaults(defineProps<Props>(), { layoutLocked: false })
const manager = toRaw(props.manager)
const registry = toRaw(props.registry)
const workspaces = shallowRef<readonly WorkspaceRuntime[]>(manager.list())
const activeWorkspaceId = shallowRef(manager.getActiveWorkspaceId())
const unsubscribe = manager.subscribe((change) => {
  workspaces.value = change.workspaces
  activeWorkspaceId.value = change.activeWorkspaceId
})
const activeWorkspace = computed(() => workspaces.value.find((workspace) => workspace.id === activeWorkspaceId.value) ?? null)
onBeforeUnmount(unsubscribe)
</script>

<template>
  <div class="wf-workspace-collection-host" :data-active-workspace-id="activeWorkspaceId ?? undefined">
    <WorkspaceHost
      v-if="activeWorkspace"
      :key="activeWorkspace.id"
      class="wf-workspace-collection-host__workspace"
      :windows="activeWorkspace.windows"
      :docks="activeWorkspace.docks"
      :registry="registry"
      :layout-locked="layoutLocked"
      :data-workspace-id="activeWorkspace.id"
    />
  </div>
</template>

<style scoped>
.wf-workspace-collection-host,.wf-workspace-collection-host__workspace{width:100%;height:100%;min-width:0;min-height:0}
</style>
