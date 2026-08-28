import { createPinia } from 'pinia';
import { createSSRApp } from 'vue';

import App from './App.vue';

export function createApp(): { app: ReturnType<typeof createSSRApp> } {
  const app = createSSRApp(App);
  app.use(createPinia());

  return { app };
}
