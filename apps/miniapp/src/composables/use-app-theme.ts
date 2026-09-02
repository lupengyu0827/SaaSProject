/** 消费者端主题状态：页面只消费语义 Token，便于后续扩展深色与租户主题。 */
import { computed, ref, type ComputedRef } from 'vue';

export type AppTheme = 'light' | 'dark';

const currentTheme = ref<AppTheme>('light');

export function useAppTheme(): {
  currentTheme: typeof currentTheme;
  themeClass: ComputedRef<string>;
  setTheme: (theme: AppTheme) => void;
} {
  const themeClass = computed(() => `theme-${currentTheme.value}`);

  function setTheme(theme: AppTheme): void {
    currentTheme.value = theme;
  }

  return { currentTheme, themeClass, setTheme };
}
