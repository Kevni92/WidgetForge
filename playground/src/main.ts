import 'widgetforge/style.css'

import { createApp, defineComponent, h, markRaw } from 'vue'
import { WidgetViewStateProvider, createLocalStorageWidgetViewStateStorage, createWidgetViewStateStore } from 'widgetforge'

import App from './App.vue'
import './style.css'

const viewStateStore = markRaw(createWidgetViewStateStore(createLocalStorageWidgetViewStateStorage(window.localStorage, 'widgetforge.playground.widget-view-state.v1')))
const Root = defineComponent({ setup: () => () => h(WidgetViewStateProvider, { store: viewStateStore }, () => h(App)) })
createApp(Root).mount('#app')
