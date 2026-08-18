<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { NotificationItem, NotificationStore } from '../core/notifications'
import type { WidgetNavigator } from '../core/navigation'

const props = withDefaults(defineProps<{
  store: NotificationStore
  navigator?: WidgetNavigator
  title?: string
  emptyText?: string
}>(), {
  title: 'Notifications',
  emptyText: 'No persistent notifications.',
})

const notifications = ref<readonly NotificationItem[]>(props.store.getSnapshot())
let unsubscribe: (() => void) | undefined

const persistent = computed(() => notifications.value
  .filter((item) => item.persistent)
  .slice()
  .reverse())

function refresh(snapshot = props.store.getSnapshot()): void {
  notifications.value = snapshot
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

onUnmounted(() => unsubscribe?.())
</script>

<template>
  <section class="wf-notification-center" aria-label="Notification center">
    <header class="wf-notification-center__header">
      <strong>{{ props.title }}</strong>
      <button
        v-if="persistent.length > 0"
        type="button"
        class="wf-notification-center__clear"
        @click="persistent.forEach((item) => props.store.dismiss(item.id))"
      >
        Clear
      </button>
    </header>

    <p v-if="persistent.length === 0" class="wf-notification-center__empty" role="status">
      {{ props.emptyText }}
    </p>

    <div v-else class="wf-notification-center__list">
      <article
        v-for="item in persistent"
        :key="item.id"
        class="wf-notification-center__item"
        :class="`wf-notification-center__item--${item.severity}`"
        :data-notification-id="item.id"
      >
        <div class="wf-notification-center__content">
          <strong>{{ item.title }}</strong>
          <p v-if="item.message">{{ item.message }}</p>
        </div>
        <div class="wf-notification-center__actions">
          <button
            v-if="item.target && props.navigator"
            type="button"
            class="wf-notification-center__action"
            @click="activate(item)"
          >
            {{ item.actionLabel ?? 'Open' }}
          </button>
          <button
            type="button"
            class="wf-notification-center__dismiss"
            :aria-label="`Dismiss ${item.title}`"
            @click="props.store.dismiss(item.id)"
          >
            ×
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.wf-notification-center {
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-md);
  background: var(--wf-color-surface);
  color: var(--wf-color-text);
  overflow: hidden;
}

.wf-notification-center__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--wf-space-md);
  min-height: var(--wf-size-titlebar-height);
  padding: 0 var(--wf-space-md);
  border-bottom: 1px solid var(--wf-color-border);
  background: var(--wf-color-surface-raised);
  font-size: var(--wf-font-size-sm);
}

.wf-notification-center__empty {
  margin: 0;
  padding: var(--wf-space-lg);
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-sm);
  text-align: center;
}

.wf-notification-center__list {
  display: grid;
}

.wf-notification-center__item {
  display: flex;
  align-items: flex-start;
  gap: var(--wf-space-md);
  padding: var(--wf-space-md);
  border-bottom: 1px solid var(--wf-color-border);
  border-left: 3px solid var(--wf-color-info);
}

.wf-notification-center__item:last-child { border-bottom: 0; }
.wf-notification-center__item--success { border-left-color: var(--wf-color-success); }
.wf-notification-center__item--warning { border-left-color: var(--wf-color-warning); }
.wf-notification-center__item--error { border-left-color: var(--wf-color-danger); }

.wf-notification-center__content {
  min-width: 0;
  flex: 1;
  font-size: var(--wf-font-size-sm);
}

.wf-notification-center__content p {
  margin: var(--wf-space-xs) 0 0;
  color: var(--wf-color-text-muted);
}

.wf-notification-center__actions {
  display: flex;
  gap: var(--wf-space-xs);
}

.wf-notification-center__clear,
.wf-notification-center__action,
.wf-notification-center__dismiss {
  min-height: var(--wf-size-control-height);
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-sm);
  background: transparent;
  color: var(--wf-color-text);
  font: inherit;
  cursor: pointer;
}

.wf-notification-center__clear,
.wf-notification-center__action { padding: 0 var(--wf-space-sm); }
.wf-notification-center__action { color: var(--wf-color-info); }
.wf-notification-center__dismiss { width: var(--wf-size-control-height); padding: 0; }

.wf-notification-center button:hover { background: var(--wf-color-hover); }
.wf-notification-center button:focus-visible {
  outline: 2px solid var(--wf-color-focus);
  outline-offset: 2px;
}
</style>
