<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import EmptyState from '../primitives/EmptyState.vue'
import { createHelpDocumentationSnapshot, searchHelpDocumentation, type HelpReferenceFilter, type HelpReferenceEntry } from '../core/help-documentation'
import { useOptionalWidgetDocumentation } from './documentation-context'
import HelpReferenceDetail from './HelpReferenceDetail.vue'
import HelpReferenceList from './HelpReferenceList.vue'

const provider = useOptionalWidgetDocumentation()
const query = ref('')
const filter = ref<HelpReferenceFilter>('all')
const selectedKey = ref<string | null>(null)
const copiedKey = ref<string | null>(null)
const copyError = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)
const detailRegion = ref<HTMLElement | null>(null)

function createSnapshot() {
  return createHelpDocumentationSnapshot(provider?.listWidgets() ?? [], provider?.listCommands() ?? [])
}

const snapshot = ref(createSnapshot())
const results = computed(() => searchHelpDocumentation(snapshot.value, query.value, filter.value))
const visibleEntries = computed(() => results.value.map((result) => result.entry))
const selectedEntry = computed<HelpReferenceEntry | null>(() => snapshot.value.entries.find((entry) => entry.key === selectedKey.value) ?? null)
const page = computed(() => selectedEntry.value ? 'detail' : 'list')
const hasProvider = provider !== null

function refresh(): void {
  snapshot.value = createSnapshot()
  if (selectedKey.value && !snapshot.value.entries.some((entry) => entry.key === selectedKey.value)) selectedKey.value = null
}

function selectEntry(key: string): void {
  selectedKey.value = key
}

function goBack(): void {
  selectedKey.value = null
  searchInput.value?.focus()
}

function focusDetail(): void {
  void nextTick(() => detailRegion.value?.querySelector<HTMLElement>('[data-help-detail-heading]')?.focus())
}

watch(selectedKey, (key) => {
  if (key) focusDetail()
  else void nextTick(() => searchInput.value?.focus())
})

async function copyText(text: string, key: string): Promise<void> {
  copyError.value = false
  try {
    let copied = false
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      copied = true
    } else if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      copied = document.execCommand('copy')
      textarea.remove()
    }
    if (!copied) throw new Error('clipboard unavailable')
    copiedKey.value = key
  } catch {
    copiedKey.value = null
    copyError.value = true
  }
}

onMounted(() => {
  refresh()
  searchInput.value?.focus()
})
</script>

<template>
  <article class="wf-help-widget" data-help-widget :data-help-page="page" tabindex="-1" @keydown.esc="selectedEntry ? goBack() : undefined">
    <header class="wf-help-widget__header">
      <div>
        <span class="wf-help-widget__eyebrow">WidgetForge</span>
        <h1 class="wf-help-widget__title">Help &amp; Reference</h1>
      </div>
      <button type="button" class="wf-help-widget__refresh" aria-label="Refresh documentation" data-help-refresh @click="refresh">↻</button>
    </header>

    <div class="wf-help-widget__toolbar">
      <label class="wf-help-widget__search-label">
        <span>Search reference</span>
        <input ref="searchInput" v-model="query" class="wf-help-widget__search" type="search" aria-label="Search widgets and commands" placeholder="Search by name, description or parameter">
      </label>
      <label class="wf-help-widget__filter-label">
        <span>Show</span>
        <select v-model="filter" class="wf-help-widget__filter" aria-label="Filter references">
          <option value="all">All</option>
          <option value="widgets">Widgets</option>
          <option value="commands">Commands</option>
        </select>
      </label>
      <span class="wf-help-widget__count" aria-live="polite">{{ visibleEntries.length }} references</span>
    </div>

    <div class="wf-help-widget__content">
      <aside class="wf-help-widget__list-panel" aria-label="Reference list">
        <HelpReferenceList v-if="visibleEntries.length" :entries="visibleEntries" :selected-key="selectedKey" @select="selectEntry" />
        <EmptyState v-else-if="!hasProvider" compact title="Documentation unavailable" message="Provide a WidgetForge documentation context to show references." />
        <EmptyState v-else compact title="No matching references" message="Try a different search or filter." />
      </aside>
      <section ref="detailRegion" class="wf-help-widget__detail-panel" aria-label="Reference detail">
        <HelpReferenceDetail v-if="selectedEntry" :entry="selectedEntry" :copied-key="copiedKey" @back="goBack" @copy="copyText" />
        <EmptyState v-else compact title="Select a reference" message="Choose a widget or command to inspect its contract." />
      </section>
    </div>
    <p v-if="copyError" class="wf-help-widget__copy-error" role="status">Copy is unavailable in this environment.</p>
  </article>
</template>

<style scoped>
.wf-help-widget{container-type:inline-size;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:var(--wf-space-md);min-width:0;min-height:0;height:100%;overflow:hidden;color:var(--wf-color-text);font-family:var(--wf-font-family)}.wf-help-widget__header{display:flex;align-items:start;justify-content:space-between;gap:var(--wf-space-md);padding:var(--wf-space-md) var(--wf-space-md) 0}.wf-help-widget__eyebrow{color:var(--wf-color-accent);font-size:var(--wf-font-size-xs);font-weight:var(--wf-font-weight-bold);letter-spacing:.04em;text-transform:uppercase}.wf-help-widget__title{margin:var(--wf-space-xs) 0 0;font-size:var(--wf-font-size-lg);font-weight:var(--wf-font-weight-bold)}.wf-help-widget__refresh{width:var(--wf-size-icon-button-size);height:var(--wf-size-icon-button-size);border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface);color:var(--wf-color-text-muted);font:inherit;cursor:pointer}.wf-help-widget__refresh:hover{background:var(--wf-color-hover);color:var(--wf-color-text)}.wf-help-widget__refresh:focus-visible,.wf-help-widget__search:focus-visible,.wf-help-widget__filter:focus-visible{outline:2px solid var(--wf-color-focus);outline-offset:2px}.wf-help-widget__toolbar{display:flex;align-items:end;gap:var(--wf-space-sm);padding:0 var(--wf-space-md)}.wf-help-widget__search-label,.wf-help-widget__filter-label{display:grid;flex:1;gap:var(--wf-space-xs);min-width:0;color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs);font-weight:var(--wf-font-weight-medium)}.wf-help-widget__filter-label{flex:0 0 auto}.wf-help-widget__search,.wf-help-widget__filter{min-height:var(--wf-size-control-height);padding:0 var(--wf-space-sm);border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface);color:var(--wf-color-text);font:inherit}.wf-help-widget__search::placeholder{color:var(--wf-color-text-placeholder);opacity:1}.wf-help-widget__count{flex:0 0 auto;padding-bottom:var(--wf-space-sm);color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs);white-space:nowrap}.wf-help-widget__content{display:grid;grid-template-columns:minmax(180px,.34fr) minmax(0,1fr);min-width:0;min-height:0;margin:0 var(--wf-space-md);overflow:hidden;border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-md);background:var(--wf-color-surface)}.wf-help-widget__list-panel,.wf-help-widget__detail-panel{min-width:0;min-height:0;overflow:auto}.wf-help-widget__list-panel{padding:var(--wf-space-sm);border-inline-end:1px solid var(--wf-color-border)}.wf-help-widget__detail-panel{display:flex;flex-direction:column}.wf-help-widget__copy-error{margin:0;padding:0 var(--wf-space-md) var(--wf-space-sm);color:var(--wf-color-danger);font-size:var(--wf-font-size-sm)}
@container (max-width:680px){.wf-help-widget__header{padding-inline:var(--wf-space-sm)}.wf-help-widget__toolbar{flex-wrap:wrap;padding-inline:var(--wf-space-sm)}.wf-help-widget__search-label{flex-basis:100%}.wf-help-widget__filter-label{flex:1}.wf-help-widget__count{margin-inline-start:auto}.wf-help-widget__content{grid-template-columns:minmax(0,1fr);margin-inline:var(--wf-space-sm)}.wf-help-widget[data-help-page="list"] .wf-help-widget__detail-panel{display:none}.wf-help-widget[data-help-page="detail"] .wf-help-widget__list-panel{display:none}.wf-help-widget__list-panel{border-inline-end:0}.wf-help-reference-detail{padding:var(--wf-space-sm)}}
</style>
