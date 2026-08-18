<script setup lang="ts">
import { computed, ref } from 'vue'
import { ThemeProvider, type WidgetForgeThemeOverride } from 'widgetforge'

const themeName = ref<'midnight' | 'paper'>('midnight')

const themes: Record<'midnight' | 'paper', WidgetForgeThemeOverride> = {
  midnight: {},
  paper: {
    color: {
      canvas: '#efe9dc',
      surface: '#fffaf0',
      surfaceRaised: '#ffffff',
      text: '#282319',
      textMuted: '#6c6253',
      border: '#cfc5b4',
      accent: '#9a3d24',
      accentContrast: '#ffffff',
      danger: '#a12727',
    },
    font: { family: 'Georgia, serif' },
    radius: { sm: '0px', md: '2px', lg: '4px' },
    shadow: { sm: '0 1px 2px rgb(60 45 20 / 0.12)', md: '0 6px 16px rgb(60 45 20 / 0.16)' },
  },
}

const activeTheme = computed(() => themes[themeName.value])
</script>

<template>
  <ThemeProvider :theme="activeTheme">
    <main class="playground-shell">
      <section class="playground-card">
        <header class="playground-header">
          <div>
            <p class="eyebrow">WidgetForge</p>
            <h1>Playground</h1>
          </div>
          <label class="theme-picker">
            Theme
            <select v-model="themeName">
              <option value="midnight">Midnight</option>
              <option value="paper">Paper</option>
            </select>
          </label>
        </header>

        <p>Die Design-Token-Grundlage ist aktiv.</p>
        <div class="token-demo">
          <div class="demo-surface">Surface</div>
          <div class="demo-surface raised">Raised surface</div>
          <p class="muted">Farben, Typografie, Spacing, Radien und Schatten kommen aus semantischen Tokens.</p>
        </div>
      </section>
    </main>
  </ThemeProvider>
</template>
