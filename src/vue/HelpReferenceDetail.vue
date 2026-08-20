<script setup lang="ts">
import type { HelpReferenceEntry } from '../core/help-documentation'

interface Props {
  entry: HelpReferenceEntry
  copiedKey?: string | null
}

const props = withDefaults(defineProps<Props>(), { copiedKey: null })
const emit = defineEmits<{ back: []; copy: [text: string, key: string] }>()

function displayValue(value: string | number | boolean | undefined): string {
  if (value === undefined) return '—'
  return String(value)
}

function requirement(required: boolean): string {
  return required ? 'Required' : 'Optional'
}

function copyLabel(key: string): string {
  return props.copiedKey === key ? 'Copied' : 'Copy'
}

function description(entry: HelpReferenceEntry): string | undefined {
  if (entry.description) return entry.description
  return entry.kind === 'widget' ? entry.documentation.summary : entry.documentation.description ?? entry.documentation.summary
}
</script>

<template>
  <section class="wf-help-reference-detail" data-help-detail aria-labelledby="help-detail-heading">
    <button class="wf-help-reference-detail__back" type="button" data-help-back @click="emit('back')">← Back to references</button>
    <template v-if="props.entry.kind === 'widget'">
      <header class="wf-help-reference-detail__header">
        <span class="wf-help-reference-detail__kind">Widget</span>
        <h2 id="help-detail-heading" class="wf-help-reference-detail__title" data-help-detail-heading tabindex="-1">{{ props.entry.title }}</h2>
        <code class="wf-help-reference-detail__id">{{ props.entry.id }}</code>
        <p v-if="description(props.entry)" class="wf-help-reference-detail__description">{{ description(props.entry) }}</p>
        <p v-if="props.entry.documentation.details" class="wf-help-reference-detail__details">{{ props.entry.documentation.details }}</p>
      </header>

      <section v-if="props.entry.commands.length" class="wf-help-reference-detail__section" aria-labelledby="help-widget-commands-heading">
        <h3 id="help-widget-commands-heading">Command / Usage</h3>
        <ul class="wf-help-reference-detail__commands" role="list">
          <li v-for="command in props.entry.commands" :key="command.name" class="wf-help-reference-detail__command">
            <code>{{ command.usage }}</code>
            <button type="button" data-help-copy :aria-label="`Copy command ${command.name}`" @click="emit('copy', command.usage, `usage:${command.name}`)">{{ copyLabel(`usage:${command.name}`) }}</button>
          </li>
        </ul>
      </section>

      <section class="wf-help-reference-detail__section" aria-labelledby="help-widget-parameters-heading">
        <h3 id="help-widget-parameters-heading">Parameters</h3>
        <div v-if="props.entry.documentation.parameters.length" class="wf-help-reference-detail__table-wrap">
          <table class="wf-help-reference-detail__table">
            <caption class="wf-help-reference-detail__caption">Widget parameters</caption>
            <thead><tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Requirement</th><th scope="col">Default</th><th scope="col">Description</th><th scope="col">Example</th></tr></thead>
            <tbody>
              <tr v-for="parameter in props.entry.documentation.parameters" :key="parameter.name">
                <th scope="row"><code>{{ parameter.name }}</code></th>
                <td><code>{{ parameter.type }}</code></td>
                <td>{{ requirement(parameter.required) }}</td>
                <td><code>{{ displayValue(parameter.default) }}</code></td>
                <td>{{ parameter.description ?? '—' }}</td>
                <td><code>{{ displayValue(parameter.example) }}</code></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="wf-help-reference-detail__muted">No parameters declared.</p>
      </section>

      <section v-if="props.entry.documentation.examples.length" class="wf-help-reference-detail__section" aria-labelledby="help-widget-examples-heading">
        <h3 id="help-widget-examples-heading">Examples</h3>
        <ul class="wf-help-reference-detail__examples" role="list">
          <li v-for="(example, index) in props.entry.documentation.examples" :key="`${example}-${index}`"><code>{{ example }}</code><button type="button" data-help-copy :aria-label="`Copy widget example ${index + 1}`" @click="emit('copy', example, `widget-example:${props.entry.id}:${index}`)">{{ copyLabel(`widget-example:${props.entry.id}:${index}`) }}</button></li>
        </ul>
      </section>
    </template>

    <template v-else>
      <header class="wf-help-reference-detail__header">
        <span class="wf-help-reference-detail__kind">Command</span>
        <h2 id="help-detail-heading" class="wf-help-reference-detail__title" data-help-detail-heading tabindex="-1">{{ props.entry.name }}</h2>
        <code class="wf-help-reference-detail__id">{{ props.entry.documentation.usage }}</code>
        <p v-if="description(props.entry)" class="wf-help-reference-detail__description">{{ description(props.entry) }}</p>
        <p v-if="props.entry.documentation.details" class="wf-help-reference-detail__details">{{ props.entry.documentation.details }}</p>
        <p v-if="props.entry.documentation.category" class="wf-help-reference-detail__muted">Category: {{ props.entry.documentation.category }}</p>
      </header>

      <section class="wf-help-reference-detail__section" aria-labelledby="help-command-usage-heading">
        <h3 id="help-command-usage-heading">Usage</h3>
        <div class="wf-help-reference-detail__copy-line"><code>{{ props.entry.documentation.usage }}</code><button type="button" data-help-copy aria-label="Copy command usage" @click="emit('copy', props.entry.documentation.usage, `usage:${props.entry.name}`)">{{ copyLabel(`usage:${props.entry.name}`) }}</button></div>
      </section>

      <section class="wf-help-reference-detail__section" aria-labelledby="help-command-arguments-heading">
        <h3 id="help-command-arguments-heading">Arguments</h3>
        <div v-if="props.entry.documentation.arguments.length" class="wf-help-reference-detail__table-wrap">
          <table class="wf-help-reference-detail__table">
            <caption class="wf-help-reference-detail__caption">Command arguments</caption>
            <thead><tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Requirement</th><th scope="col">Default</th><th scope="col">Description</th><th scope="col">Example</th></tr></thead>
            <tbody>
              <tr v-for="argument in props.entry.documentation.arguments" :key="argument.name">
                <th scope="row"><code>{{ argument.name }}</code></th>
                <td><code>{{ argument.type }}</code></td>
                <td>{{ requirement(argument.required) }}</td>
                <td><code>{{ displayValue(argument.default) }}</code></td>
                <td>{{ argument.description ?? '—' }}</td>
                <td><code>{{ displayValue(argument.example) }}</code></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="wf-help-reference-detail__muted">No arguments declared.</p>
      </section>

      <section v-if="props.entry.documentation.examples.length" class="wf-help-reference-detail__section" aria-labelledby="help-command-examples-heading">
        <h3 id="help-command-examples-heading">Examples</h3>
        <ul class="wf-help-reference-detail__examples" role="list">
          <li v-for="(example, index) in props.entry.documentation.examples" :key="`${example}-${index}`"><code>{{ example }}</code><button type="button" data-help-copy :aria-label="`Copy command example ${index + 1}`" @click="emit('copy', example, `command-example:${props.entry.name}:${index}`)">{{ copyLabel(`command-example:${props.entry.name}:${index}`) }}</button></li>
        </ul>
      </section>

      <p class="wf-help-reference-detail__muted">Opens widget: <code>{{ props.entry.widgetId }}</code></p>
    </template>
  </section>
</template>

<style scoped>
.wf-help-reference-detail{display:grid;align-content:start;gap:var(--wf-space-md);min-width:0;overflow:auto;padding:var(--wf-space-md)}.wf-help-reference-detail__back{justify-self:start;padding:var(--wf-space-xs) var(--wf-space-sm);border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface);color:var(--wf-color-text-muted);font:inherit;cursor:pointer}.wf-help-reference-detail__back:hover{background:var(--wf-color-hover);color:var(--wf-color-text)}.wf-help-reference-detail__back:focus-visible,.wf-help-reference-detail button:focus-visible{outline:2px solid var(--wf-color-focus);outline-offset:2px}.wf-help-reference-detail__header{display:grid;gap:var(--wf-space-xs);min-width:0}.wf-help-reference-detail__kind{color:var(--wf-color-accent);font-size:var(--wf-font-size-xs);font-weight:var(--wf-font-weight-bold);text-transform:uppercase}.wf-help-reference-detail__title{margin:0;font-size:var(--wf-font-size-lg);font-weight:var(--wf-font-weight-bold)}.wf-help-reference-detail__title:focus{outline:2px solid var(--wf-color-focus);outline-offset:2px}.wf-help-reference-detail__id{overflow:hidden;color:var(--wf-color-text-muted);font-size:var(--wf-font-size-sm);text-overflow:ellipsis;white-space:nowrap}.wf-help-reference-detail__description,.wf-help-reference-detail__details{margin:0;color:var(--wf-color-text-muted);font-size:var(--wf-font-size-sm);line-height:1.45}.wf-help-reference-detail__details{color:var(--wf-color-text)}.wf-help-reference-detail__section{display:grid;gap:var(--wf-space-sm);min-width:0}.wf-help-reference-detail__section h3{margin:0;font-size:var(--wf-font-size-sm)}.wf-help-reference-detail__table-wrap{max-width:100%;overflow:auto;border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm)}.wf-help-reference-detail__table{width:100%;min-width:560px;border-collapse:collapse;background:var(--wf-color-surface);font-size:var(--wf-font-size-sm)}.wf-help-reference-detail__table th,.wf-help-reference-detail__table td{padding:var(--wf-space-sm);border-bottom:1px solid var(--wf-color-border);text-align:start;vertical-align:top}.wf-help-reference-detail__table thead th{background:var(--wf-color-surface-raised);color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs);font-weight:var(--wf-font-weight-bold)}.wf-help-reference-detail__table tbody tr:last-child th,.wf-help-reference-detail__table tbody tr:last-child td{border-bottom:0}.wf-help-reference-detail__commands,.wf-help-reference-detail__examples{display:grid;gap:var(--wf-space-xs);margin:0;padding:0;list-style:none}.wf-help-reference-detail__commands li,.wf-help-reference-detail__examples li,.wf-help-reference-detail__copy-line{display:flex;min-width:0;align-items:center;justify-content:space-between;gap:var(--wf-space-sm);padding:var(--wf-space-sm);border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface)}.wf-help-reference-detail__commands code,.wf-help-reference-detail__examples code,.wf-help-reference-detail__copy-line code{min-width:0;overflow:auto;white-space:pre-wrap}.wf-help-reference-detail__commands button,.wf-help-reference-detail__examples button,.wf-help-reference-detail__copy-line button{flex:0 0 auto;padding:var(--wf-space-xs) var(--wf-space-sm);border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface-raised);color:var(--wf-color-text);font:inherit;cursor:pointer}.wf-help-reference-detail__commands button:hover,.wf-help-reference-detail__examples button:hover,.wf-help-reference-detail__copy-line button:hover{background:var(--wf-color-hover)}.wf-help-reference-detail__muted{margin:0;color:var(--wf-color-text-muted);font-size:var(--wf-font-size-sm)}.wf-help-reference-detail__caption{padding:var(--wf-space-sm);color:var(--wf-color-text-muted);font-weight:var(--wf-font-weight-medium);text-align:start;caption-side:top}
</style>
