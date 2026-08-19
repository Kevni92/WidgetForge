<script setup lang="ts">
import { toRaw } from 'vue'
import type { SelectionStore } from '../core/selection'
import { provideSelectionStore } from './selection-context'

const props = defineProps<{ store: SelectionStore }>()
provideSelectionStore(toRaw(props.store))
</script>

<template><slot /></template>
