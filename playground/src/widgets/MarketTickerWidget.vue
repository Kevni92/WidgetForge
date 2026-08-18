<script setup lang="ts">
import { useWidgetContext } from 'widgetforge'

const context = useWidgetContext<{ commodity?: string; rows?: number }>()
</script>

<template>
  <article class="dummy-widget">
    <strong>Market Ticker</strong>
    <span>Commodity: {{ context.parameters.value.commodity ?? 'ALL' }}</span>
    <span>Rows: {{ context.parameters.value.rows }}</span>
    <span>Instance: {{ context.instanceId }}</span>
  </article>
</template>
