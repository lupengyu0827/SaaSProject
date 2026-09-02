import { createPinia } from 'pinia';
import { createSSRApp } from 'vue';

import App from './App.vue';

/** 创建隔离于消费者小程序的商家应用实例。 */
export function createApp(): { app: ReturnType<typeof createSSRApp> } {
  const app = createSSRApp(App);
  app.use(createPinia());
  return { app };
}
