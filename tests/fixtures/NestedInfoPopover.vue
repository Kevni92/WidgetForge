<script setup lang="ts">
import InfoPopover from '../../src/primitives/InfoPopover.vue'
</script>

<template>
  <InfoPopover data-test="outer" label="Efficiency">
    <template #trigger>Efficiency</template>
    <div data-test="outer-content">
      <strong>Output efficiency</strong>
      <p>Base output multiplied by workforce.</p>
      <InfoPopover data-test="inner" label="Workforce" placement="right">
        <template #trigger>Workforce</template>
        <div data-test="inner-content">
          <span>Available staffed capacity.</span>
          <InfoPopover data-test="deep" label="Capacity" placement="right">
            <template #trigger>Capacity</template>
            <span data-test="deep-content">Maximum staffed production slots.</span>
          </InfoPopover>
        </div>
      </InfoPopover>
    </div>
  </InfoPopover>
</template>
