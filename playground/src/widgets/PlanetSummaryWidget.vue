<script setup lang="ts">
import { useWidgetContext, useWidgetNavigation } from 'widgetforge'

const context = useWidgetContext<{ planetId: string; compact?: boolean }>()
const navigation = useWidgetNavigation()

function openMarket(): void {
  navigation.navigate({
    widgetId: 'market.ticker',
    parameters: { commodity: 'METALS', rows: 6 },
  })
}
</script>

<template>
  <article class="dummy-widget">
    <strong>Planet Summary</strong>
    <span>Planet: {{ context.parameters.value.planetId }}</span>
    <span>Instance: {{ context.instanceId }}</span>
    <button type="button" data-navigation="market" @click="openMarket">Open Market</button>
  </article>
</template>
