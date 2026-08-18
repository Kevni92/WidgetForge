<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { NotificationItem, NotificationStore } from '../core/notifications'
import type { WidgetNavigator } from '../core/navigation'

const props = withDefaults(defineProps<{
  store: NotificationStore
  navigator?: WidgetNavigator
  maxVisible?: number
}>(), {
  maxVisible: 4,
})

const notifications = ref<readonly NotificationItem[]>(props.store.getSnapshot())
const timers = new Map<string, ReturnType<typeof setTimeout>>()
let unsubscribe: (() => void) | undefined

const visible = computed(() => notifications.value
  .filter((item) => !item.persistent)
  .slice(-Math.max(1, props.maxVisible)))

function syncTimers(): void {
  const currentIds = new Set(visible.value.map((item) => item.id))
  for (const [id, timer] of timers) {
    if (!currentIds.has(id)) {
      clearTimeout(timer)
      timers.delete(id)
    }
  }

  for (const item of visible.value) {
    if (timers.has(item.id) || item.durationMs === null || item.durationMs <= 0) continue
    const timer = setTimeout(() => {
      timers.delete(item.id)
      props.store.dismiss(item.id)
    }, item.durationMs)
    timers.set(item.id, timer)
  }
}

function refresh(snapshot = props.store.getSnapshot()): void {
  notifications.value = snapshot
  syncTimers()
}

function activate(item: NotificationItem): void {
  if (!item.target || !props.navigator) return
  props.navigator.navigate(item.target)
  props.store.dismiss(item.id)
}

onMounted(() => {
  unsubscribe = props.store.subscribe(refresh)
  refresh()
})

onUnmounted(() => {
  unsubscribe?.()
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
})
</script>

<template>
  <div class="wf-notification-toasts" aria-live="polite" aria-relevant="additions removals">
    <article
      v-for="item in visible"
      :key="item.id"
      class="wf-notification-toast"
      :class="`wf-notification-toast--${item.severity}`"
      :data-notification-id="item.id"
      :role="item.severity === 'error' ? 'alert' : 'status'"
    >
      <div class="wf-notification-toast__content">
        <strong>{{ item.title }}</strong>
        <p v-if="item.message">{{ item.message }}</p>
      </div>
      <div class="wf-notification-toast__actions">
        <button
          v-if="item.target && props.navigator"
          type="button"
          class="wf-notification-toast__action"
          @click="activate(item)"
        >
          {{ item.actionLabel ?? 'Open' }}
        </button>
        <button
          type="button"
          class="wf-notification-toast__dismiss"
          :aria-label="`Dismiss ${item.title}`"
          @click="props.store.dismiss(item.id)"
        >
          ×
        </button>
      </div>
    </article>
  </div>
</template>

<style scoped>
.wf-notification-toasts {
  position: fixed;
  right: var(--wf-space-lg);
  bottom: var(--wf-space-lg);
  z-index: var(--wf-layer-overlay);
  display: grid;
  width: min(380px, calc(100vw - 2 * var(--wf-space-lg)));
  gap: var(--wf-space-sm);
  pointer-events: none;
}

.wf-notification-toast {
  display: flex;
  gap: var(--wf-space-md);
  align-items: flex-start;
  padding: var(--wf-space-md);
  border: 1px solid var(--wf-color-border);
  border-left-width: 3px;
  border-radius: var(--wf-radius-md);
  background: var(--wf-color-surface-raised);
  color: var(--wf-color-text);
  box-shadow: var(--wf-shadow-md);
  pointer-events: auto;
}

.wf-notification-toast--info { border-left-color: var(--wf-color-info); }
.wf-notification-toast--success { border-left-color: var(--wf-color-success); }
.wf-notification-toast--warning { border-left-color: var(--wf-color-warning); }
.wf-notification-toast--error { border-left-color: var(--wf-color-danger); }

.wf-notification-toast__content {
  min-width: 0;
  flex: 1;
  font-size: var(--wf-font-size-sm);
}

.wf-notification-toast__content p {
  margin: var(--wf-space-xs) 0 0;
  color: var(--wf-color-text-muted);
}

.wf-notification-toast__actions {
  display: flex;
  gap: var(--wf-space-xs);
}

.wf-notification-toast__action,
.wf-notification-toast__dismiss {
  min-height: var(--wf-size-control-height);
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-sm);
  background: transparent;
  color: var(--wf-color-text);
  font: inherit;
  cursor: pointer;
}

.wf-notification-toast__action {
  padding: 0 var(--wf-space-sm);
  color: var(--wf-color-info);
}

.wf-notification-toast__dismiss {
  width: var(--wf-size-control-height);
  padding: 0;
}

.wf-notification-toast__action:hover,
.wf-notification-toast__dismiss:hover { background: var(--wf-color-hover); }

.wf-notification-toast__action:focus-visible,
.wf-notification-toast__dismiss:focus-visible {
  outline: 2px solid var(--wf-color-focus);
  outline-offset: 2px;
}
</style>
