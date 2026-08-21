<script setup lang="ts">
export type WfIconName =
  | 'lock'
  | 'unlock'
  | 'close'
  | 'minimize'
  | 'restore'
  | 'dock'
  | 'undock'
  | 'inspector'
  | 'layout'
  | 'style'
  | 'link'
  | 'unlink'
  | 'move'
  | 'reset'
  | 'connections'
  | 'undo'
  | 'redo'
  | 'border-top'
  | 'border-right'
  | 'border-bottom'
  | 'border-left'
  | 'check'
  | 'edit'

defineProps<{ name: WfIconName }>()
</script>

<template>
  <svg class="wf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <template v-if="name === 'lock' || name === 'unlock'">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path v-if="name === 'lock'" d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path v-else d="M8 10V7a4 4 0 0 1 7.2-2.4" />
      <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="m6 6 12 12M18 6 6 18" />
    </template>
    <template v-else-if="name === 'minimize'">
      <path d="M5 17h14" />
    </template>
    <template v-else-if="name === 'restore'">
      <rect x="7" y="7" width="11" height="11" rx="1.5" />
      <path d="M5 15V6a1 1 0 0 1 1-1h9" />
    </template>
    <template v-else-if="name === 'dock'">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M15 4v16M8 9l-3 3 3 3" />
    </template>
    <template v-else-if="name === 'undock'">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 4v16M16 9l3 3-3 3" />
    </template>
    <template v-else-if="name === 'inspector' || name === 'layout'">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 9h16M9 9v11" />
      <path v-if="name === 'inspector'" d="M13 13h4M13 16h3" />
      <path v-else d="M12 12h5M12 15h5" />
    </template>
    <template v-else-if="name === 'style'">
      <path d="M5 19 16.5 7.5a2.1 2.1 0 0 1 3 3L8 22H5z" />
      <path d="m14 10 3 3M5 5h5M7.5 2.5v5M18 16h3M19.5 14.5v3" />
    </template>
    <template v-else-if="name === 'link' || name === 'unlink'">
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M7.5 17.5h-1a4 4 0 0 1 0-8h3M16.5 6.5h1a4 4 0 0 1 0 8h-3" />
      <path v-if="name === 'unlink'" d="m4 4 16 16" />
    </template>
    <template v-else-if="name === 'move'">
      <path d="M12 3v18M3 12h18M12 3l-2 2M12 3l2 2M12 21l-2-2M12 21l2-2M3 12l2-2M3 12l2 2M21 12l-2-2M21 12l-2 2" />
    </template>
    <template v-else-if="name === 'reset'">
      <path d="M4 9a8 8 0 1 1 2 8" />
      <path d="M4 4v5h5" />
    </template>
    <template v-else-if="name === 'connections'">
      <circle cx="6" cy="12" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="m8 11 8-4M8 13l8 4" />
    </template>
    <template v-else-if="name === 'undo' || name === 'redo'">
      <path :d="name === 'undo' ? 'M9 8H4l4-4M4 8c7-2 12 0 14 6' : 'M15 8h5l-4-4M20 8c-7-2-12 0-14 6'" />
    </template>
    <template v-else-if="name === 'border-top'">
      <rect x="5" y="6" width="14" height="12" rx="1" />
      <path d="M5 6h14" stroke-width="3" />
    </template>
    <template v-else-if="name === 'border-right'">
      <rect x="5" y="6" width="14" height="12" rx="1" />
      <path d="M19 6v12" stroke-width="3" />
    </template>
    <template v-else-if="name === 'border-bottom'">
      <rect x="5" y="6" width="14" height="12" rx="1" />
      <path d="M5 18h14" stroke-width="3" />
    </template>
    <template v-else-if="name === 'border-left'">
      <rect x="5" y="6" width="14" height="12" rx="1" />
      <path d="M5 6v12" stroke-width="3" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12 4 4L19 6" />
    </template>
    <template v-else-if="name === 'edit'">
      <path d="m5 16-1 4 4-1L19 8a2.1 2.1 0 0 0-3-3zM14 6l4 4" />
    </template>
  </svg>
</template>

<style scoped>
.wf-icon {
  display: block;
  width: 1em;
  height: 1em;
  flex: 0 0 auto;
  overflow: visible;
}
</style>
