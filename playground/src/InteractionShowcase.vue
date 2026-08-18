<script setup lang="ts">
import { markRaw, ref } from 'vue'
import {
  ConfirmationDialog,
  ContextMenuHost,
  createContextMenuController,
  type WidgetNavigator,
} from 'widgetforge'

const props = defineProps<{ navigator: WidgetNavigator }>()
const contextMenu = markRaw(createContextMenuController())
const confirmationOpen = ref(false)
const lastAction = ref('none')
const lastDecision = ref('none')

function showContextMenu(event: MouseEvent): void {
  contextMenu.show({
    x: event.clientX,
    y: event.clientY,
    items: [
      {
        id: 'open-market',
        label: 'Open steel market',
        target: { widgetId: 'market.ticker', parameters: { commodity: 'STEEL', rows: 5 } },
      },
      { id: 'pin', label: 'Pin selection' },
      { id: 'delete', label: 'Delete local marker', tone: 'danger' },
      { id: 'disabled', label: 'Unavailable action', disabled: true },
    ],
    onSelect: (item) => {
      lastAction.value = item.id
    },
  })
}

function showKeyboardMenu(): void {
  contextMenu.show({
    x: 80,
    y: 80,
    items: [
      { id: 'inspect', label: 'Inspect selection' },
      { id: 'open-market', label: 'Open steel market', target: { widgetId: 'market.ticker' } },
    ],
    onSelect: (item) => {
      lastAction.value = item.id
    },
  })
}
</script>

<template>
  <section class="demo-section interaction-showcase">
    <h2>Context Menu & Confirmation</h2>
    <div
      class="interaction-showcase__target"
      tabindex="0"
      aria-label="Context menu demonstration area"
      @contextmenu.prevent="showContextMenu"
      @keydown.shift.f10.prevent="showKeyboardMenu"
    >
      Right-click here or press Shift+F10.
    </div>
    <div class="playground-actions interaction-showcase__actions">
      <button type="button" data-confirm-demo @click="confirmationOpen = true">Open confirmation</button>
      <span>Last menu action: {{ lastAction }}</span>
      <span>Last decision: {{ lastDecision }}</span>
    </div>

    <ContextMenuHost :controller="contextMenu" :navigator="props.navigator" />
    <ConfirmationDialog
      v-model:open="confirmationOpen"
      title="Delete local layout marker?"
      message="This demo only confirms a consumer-owned action; WidgetForge performs no domain operation."
      confirm-label="Delete marker"
      tone="danger"
      @confirm="lastDecision = 'confirmed'"
      @cancel="lastDecision = 'cancelled'"
    />
  </section>
</template>

<style scoped>
.interaction-showcase__target {
  padding: var(--wf-space-lg);
  border: 1px dashed var(--wf-color-border);
  border-radius: var(--wf-radius-md);
  background: var(--wf-color-surface);
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-sm);
}

.interaction-showcase__target:focus-visible {
  outline: 2px solid var(--wf-color-focus);
  outline-offset: 2px;
}

.interaction-showcase__actions {
  align-items: center;
  margin-top: var(--wf-space-md);
}

.interaction-showcase__actions span {
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-xs);
}
</style>
