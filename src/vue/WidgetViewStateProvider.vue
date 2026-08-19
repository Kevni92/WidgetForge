<script setup lang="ts">
import { toRaw } from 'vue'
import type { WidgetViewStateStore } from '../core/widget-view-state'
import { provideWidgetViewState } from './widget-view-state'

interface Props { store: WidgetViewStateStore; scopeId?: string }
const props = withDefaults(defineProps<Props>(), { scopeId: 'default' })
provideWidgetViewState(toRaw(props.store), () => props.scopeId)
</script>

<template><slot /></template>
