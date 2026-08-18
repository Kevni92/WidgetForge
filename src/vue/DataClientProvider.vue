<script setup lang="ts">
import type { DataClient } from '../data/data-client'
import { provideDataClient } from './data-context'

const props = defineProps<{ client: DataClient }>()
provideDataClient(props.client)
</script>

<template>
  <slot />
</template>
