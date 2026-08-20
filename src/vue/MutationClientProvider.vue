<script setup lang="ts">
import type { MutationClient } from '../data/mutation-client'
import { provideMutationClient } from './mutation-context'

const props = defineProps<{ client: MutationClient }>()
provideMutationClient(props.client)
</script>

<template>
  <slot />
</template>
