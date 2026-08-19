import 'widgetforge/style.css'

import { createApp, defineComponent, h, markRaw } from 'vue'
import {
  SelectionProvider,
  WidgetViewStateProvider,
  createLocalStorageWidgetViewStateStorage,
  createSelectionStore,
  createWidgetViewStateStore,
} from 'widgetforge'

import App from './App.vue'
import './style.css'

const viewStateStore = markRaw(createWidgetViewStateStore(createLocalStorageWidgetViewStateStorage(window.localStorage, 'widgetforge.playground.widget-view-state.v1')))
const selectionStore = markRaw(createSelectionStore())
const Root = defineComponent({
  setup: () => () => h(SelectionProvider, { store: selectionStore }, () => h(WidgetViewStateProvider, { store: viewStateStore }, () => h(App))),
})
createApp(Root).mount('#app')
