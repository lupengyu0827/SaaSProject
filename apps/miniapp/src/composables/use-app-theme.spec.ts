/** 消费者主题测试：保证浅色默认值与后续深色切换使用稳定语义类名。 */
import { describe, expect, it } from 'vitest';

import { useAppTheme } from './use-app-theme';

describe('useAppTheme', () => {
  it('switches between light and dark semantic theme classes', () => {
    const { setTheme, themeClass } = useAppTheme();
    setTheme('light');
    expect(themeClass.value).toBe('theme-light');
    setTheme('dark');
    expect(themeClass.value).toBe('theme-dark');
    setTheme('light');
  });
});
