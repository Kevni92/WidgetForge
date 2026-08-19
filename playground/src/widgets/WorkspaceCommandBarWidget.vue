<script setup lang="ts">
import { CommandInput, useWidgetNavigation } from 'widgetforge'
import { playgroundCommands } from '../playground-commands'

const navigator = useWidgetNavigation()
</script>

<template>
  <div class="workspace-commandbar">
    <span class="workspace-commandbar__prompt">APEX://</span>
    <CommandInput :commands="playgroundCommands" :navigator="navigator" placeholder="planet ARC-03" />
    <span class="workspace-commandbar__hint">Ctrl+K palette · Tab grip → reorder · Edit/Ctrl pane surface → move or detach</span>
  </div>
</template>

<style scoped>
.workspace-commandbar{height:100%;display:grid;grid-template-columns:auto minmax(260px,1fr) auto;align-items:center;gap:var(--wf-space-sm);padding:0 var(--wf-space-md);background:var(--wf-color-surface);overflow:hidden}.workspace-commandbar__prompt{color:var(--wf-color-accent);font-size:var(--wf-font-size-xs);font-weight:var(--wf-font-weight-bold);letter-spacing:.08em}.workspace-commandbar :deep(.wf-command-input){position:static;display:grid;grid-template-columns:1fr auto;gap:var(--wf-space-xs);align-items:center}.workspace-commandbar :deep(.wf-command-input__field){min-width:0;height:30px}.workspace-commandbar :deep(.wf-command-input__feedback){grid-column:1/-1;right:var(--wf-space-md);bottom:var(--wf-size-control-height);left:calc(var(--wf-space-md) + var(--wf-size-control-height));padding:var(--wf-space-xs) var(--wf-space-sm);border-color:var(--wf-color-border-floating);background:var(--wf-color-surface-floating)}.workspace-commandbar :deep(.wf-command-input__feedback--error){border-color:var(--wf-color-danger)}.workspace-commandbar__hint{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs);white-space:nowrap}
@media(max-width:760px){.workspace-commandbar{grid-template-columns:auto 1fr}.workspace-commandbar__hint{display:none}}
</style>
