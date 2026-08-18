<script setup lang="ts">
</script>

<template>
  <div class="example-widget">
    <strong>Hello from a packaged WidgetForge consumer.</strong>
    <p>This component is registered by the consuming application.</p>
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
