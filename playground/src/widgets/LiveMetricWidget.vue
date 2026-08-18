<script setup lang="ts">
import { computed } from 'vue'
import { createDataKey, useData, useWidgetContext } from 'widgetforge'

interface DemoMetric {
  label: string
  value: number
  unit: string
}

const context = useWidgetContext<{ resourceId: string }>()
const resourceId = context.parameters.value.resourceId
const state = useData(createDataKey<DemoMetric>('demo.metric', resourceId))
const valueText = computed(() => state.value.status === 'ready' ? state.value.data.value.toFixed(1) : '—')
</script>

<template>
  <article class="live-metric-widget" :data-resource-id="resourceId">
    <span class="live-metric-widget__eyebrow">Live resource</span>
    <template v-if="state.status === 'ready'">
      <strong>{{ state.data.label }}</strong>
      <span class="live-metric-widget__value">{{ valueText }} {{ state.data.unit }}</span>
    </template>
    <span v-else-if="state.status === 'loading'" class="live-metric-widget__state">Loading…</span>
    <span v-else class="live-metric-widget__state live-metric-widget__state--error">{{ state.error.message }}</span>
  </article>
</template>

<style scoped>
.live-metric-widget { display: grid; gap: var(--wf-space-sm); }
.live-metric-widget__eyebrow { color: var(--wf-color-text-muted); font-size: var(--wf-font-size-xs); text-transform: uppercase; letter-spacing: 0.08em; }
.live-metric-widget__value { color: var(--wf-color-accent); font-size: var(--wf-font-size-lg); font-weight: var(--wf-font-weight-bold); }
.live-metric-widget__state { color: var(--wf-color-text-muted); }
.live-metric-widget__state--error { color: var(--wf-color-danger); }
</style>
