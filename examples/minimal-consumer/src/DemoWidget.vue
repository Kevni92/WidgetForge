<script setup lang="ts">
import { computed } from 'vue'
import { useData, useMutation } from 'widgetforge'
import { demoMutation, demoResource } from './fixture-contract'

const resource = useData(demoResource)
const mutation = useMutation(demoMutation)
const value = computed(() => resource.value.status === 'ready' ? resource.value.data.value : 0)
const mutationState = computed(() => mutation.state.value)

async function executeMutation(): Promise<void> {
  await mutation.execute({ value: value.value })
}
</script>

<template>
  <div class="example-widget">
    <strong>Hello from a packaged WidgetForge consumer.</strong>
    <p>Read state: {{ resource.status }} (value: {{ value }})</p>
    <button type="button" :disabled="mutationState.status === 'pending'" @click="executeMutation">
      Run generic mutation
    </button>
    <p v-if="mutationState.status === 'success'">Mutation confirmed by the fake transport.</p>
    <p v-if="mutationState.status === 'error'">Mutation failed: {{ mutationState.error.message }}</p>
  </div>
</template>

<style scoped>
.example-widget {
  display: grid;
  gap: var(--wf-space-sm);
  padding: var(--wf-space-md);
  color: var(--wf-color-text);
}

.example-widget p {
  margin: 0;
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-sm);
}
</style>
