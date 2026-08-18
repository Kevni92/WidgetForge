<script setup lang="ts">
import { markRaw } from 'vue'
import { NotificationCenter, createNotificationStore, useWidgetNavigation } from 'widgetforge'

const navigator = useWidgetNavigation()
const store = markRaw(createNotificationStore())

store.notify({
  title: 'Cargo throughput below target',
  message: 'Warehouse Delta is operating at 82% of the planned outbound rate.',
  severity: 'warning',
  persistent: true,
  target: { widgetId: 'planet.summary', parameters: { planetId: 'ARC-01', compact: false } },
  actionLabel: 'Inspect colony',
})
store.notify({
  title: 'METALS spread opportunity',
  message: 'Bid/ask spread widened beyond the configured observation threshold.',
  severity: 'info',
  persistent: true,
  target: { widgetId: 'market.ticker', parameters: { commodity: 'METALS', rows: 10 } },
  actionLabel: 'Open market',
})
store.notify({
  title: 'Power reserve stable',
  message: 'Grid reserve recovered above 18 MW.',
  severity: 'success',
  persistent: true,
})
</script>

<template>
  <div class="alerts-widget">
    <NotificationCenter :store="store" :navigator="navigator" title="Operations Alerts" empty-text="No active alerts." />
  </div>
</template>

<style scoped>
.alerts-widget{height:100%;padding:var(--wf-space-sm);overflow:auto;background:var(--wf-color-canvas)}.alerts-widget :deep(.wf-notification-center){border:0;background:transparent}.alerts-widget :deep(.wf-notification-center__header){background:transparent}
</style>
