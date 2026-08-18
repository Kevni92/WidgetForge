<script setup lang="ts">
import InfoPopover from '../../src/primitives/InfoPopover.vue'
import KeyValueGroup from '../../src/primitives/KeyValueGroup.vue'
import KeyValueRow from '../../src/primitives/KeyValueRow.vue'
import StatValue from '../../src/primitives/StatValue.vue'
</script>

<template>
  <KeyValueGroup compact :columns="2" label="Facility statistics">
    <KeyValueRow>
      <template #label>
        <InfoPopover label="Efficiency explanation">
          <template #trigger>Efficiency</template>
          Base output multiplied by staffing.
        </InfoPopover>
      </template>
      <template #value>
        <StatValue :value="84" unit="%" tone="success" label="Efficiency 84 percent" />
      </template>
    </KeyValueRow>

    <KeyValueRow label="Maintenance">
      <template #value>
        <button type="button" data-test="maintenance-action">Scheduled</button>
      </template>
    </KeyValueRow>
  </KeyValueGroup>
</template>
