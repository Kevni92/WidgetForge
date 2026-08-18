<script setup lang="ts">
import { InfoPopover } from 'widgetforge'
</script>

<template>
  <section class="demo-section primitive-showcase">
    <h2>UI Primitives</h2>
    <div class="primitive-showcase__row">
      <span>Production efficiency</span>
      <InfoPopover data-demo="efficiency-info" label="Production efficiency">
        <template #trigger>84%</template>
        <div class="primitive-showcase__popover-content">
          <strong>Production efficiency</strong>
          <p>Base output × workforce × maintenance.</p>
          <InfoPopover data-demo="workforce-info" label="Workforce" placement="right">
            <template #trigger>Workforce</template>
            <div class="primitive-showcase__popover-content">
              <span>Current staffing factor: 0.92</span>
              <InfoPopover data-demo="capacity-info" label="Capacity" placement="right">
                <template #trigger>Capacity</template>
                <span>Maximum staffed production slots for this facility.</span>
              </InfoPopover>
            </div>
          </InfoPopover>
        </div>
      </InfoPopover>
    </div>
  </section>
</template>

<style scoped>
.primitive-showcase__row {
  display: flex;
  align-items: center;
  gap: var(--wf-space-md);
  min-height: var(--wf-size-control-height);
}

.primitive-showcase__popover-content {
  display: grid;
  gap: var(--wf-space-sm);
}

.primitive-showcase__popover-content p {
  margin: 0;
  color: var(--wf-color-text-muted);
}
</style>
