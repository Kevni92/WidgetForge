<script setup lang="ts">
import { InfoPopover, KeyValueGroup, KeyValueRow, StatValue } from 'widgetforge'
</script>

<template>
  <section class="demo-section primitive-showcase">
    <h2>UI Primitives</h2>

    <KeyValueGroup compact :columns="2" label="Production statistics">
      <KeyValueRow>
        <template #label>
          <InfoPopover data-demo="efficiency-info" label="Production efficiency">
            <template #trigger>Production efficiency</template>
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
        </template>
        <template #value>
          <StatValue :value="84" unit="%" tone="success" label="Production efficiency 84 percent" />
        </template>
      </KeyValueRow>

      <KeyValueRow label="Grid load">
        <template #value>
          <StatValue :value="118.5" unit="MW" tone="warning" label="Grid load 118.5 megawatts" />
        </template>
      </KeyValueRow>

      <KeyValueRow label="Warehouse stock">
        <template #value>
          <StatValue :value="640" unit="t" />
        </template>
      </KeyValueRow>

      <KeyValueRow label="Maintenance">
        <template #value>
          <span class="primitive-showcase__status">Scheduled</span>
        </template>
      </KeyValueRow>
    </KeyValueGroup>
  </section>
</template>

<style scoped>
.primitive-showcase__popover-content {
  display: grid;
  gap: var(--wf-space-sm);
}

.primitive-showcase__popover-content p {
  margin: 0;
  color: var(--wf-color-text-muted);
}

.primitive-showcase__status {
  color: var(--wf-color-info);
  font-size: var(--wf-font-size-sm);
  font-weight: var(--wf-font-weight-medium);
}
</style>
