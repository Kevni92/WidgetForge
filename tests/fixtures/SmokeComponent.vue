<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<template>
  <span data-testid="label">{{ label }}</span>
</template>
