<script setup lang="ts">
import { markRaw } from 'vue'
import {
  NotificationCenter,
  NotificationToastHost,
  createNotificationStore,
  type WidgetNavigator,
} from 'widgetforge'

const props = defineProps<{ navigator: WidgetNavigator }>()
const notifications = markRaw(createNotificationStore({ defaultDurationMs: 4_000 }))

function showInfo(): void {
  notifications.notify({
    title: 'Workspace saved',
    message: 'The current window layout was stored.',
    severity: 'info',
  })
}

function showSuccess(): void {
  notifications.notify({
    title: 'Production complete',
    message: 'A generic short-lived success notification.',
    severity: 'success',
  })
}

function showPersistentWarning(): void {
  notifications.notify({
    title: 'Market threshold reached',
    message: 'This persistent notification can open an existing WidgetForge widget.',
    severity: 'warning',
    persistent: true,
    actionLabel: 'Open market',
    target: { widgetId: 'market.ticker', parameters: { commodity: 'STEEL', rows: 5 } },
  })
}
</script>

<template>
  <section class="demo-section notification-showcase">
    <h2>Notifications</h2>
    <div class="playground-actions">
      <button type="button" data-notification-demo="info" @click="showInfo">Info toast</button>
      <button type="button" data-notification-demo="success" @click="showSuccess">Success toast</button>
      <button type="button" data-notification-demo="persistent" @click="showPersistentWarning">
        Persistent warning
      </button>
    </div>
    <NotificationCenter class="notification-showcase__center" :store="notifications" :navigator="props.navigator" />
    <NotificationToastHost :store="notifications" :navigator="props.navigator" />
  </section>
</template>

<style scoped>
.notification-showcase__center {
  margin-top: var(--wf-space-md);
}
</style>
