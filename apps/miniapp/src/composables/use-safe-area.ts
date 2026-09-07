/** 安全区域：返回状态栏与导航栏高度，供自定义导航栏页面适配刘海屏。 */
import { ref } from 'vue';

export interface SafeAreaInfo {
  statusBarHeight: number;
  navigationBarHeight: number;
  safeAreaBottom: number;
}

const cache = ref<SafeAreaInfo | null>(null);

export function useSafeArea(): SafeAreaInfo {
  if (cache.value) return cache.value;

  let statusBarHeight = 0;
  let navigationBarHeight = 44;
  let safeAreaBottom = 0;

  try {
    const sys = uni.getSystemInfoSync();
    statusBarHeight = sys.statusBarHeight ?? 0;
    safeAreaBottom =
      (sys.safeAreaInsets?.bottom as number | undefined) ??
      (sys.safeArea?.bottom ? Math.max(0, sys.screenHeight - sys.safeArea.bottom) : 0);

    const menu = uni.getMenuButtonBoundingClientRect?.();
    if (menu && menu.height) {
      navigationBarHeight = (menu.top - statusBarHeight) * 2 + menu.height;
    } else {
      // 拿不到胶囊时按 iOS 44px + Android 48px 保守估算
      navigationBarHeight = sys.platform === 'ios' ? 44 : 48;
    }
  } catch {
    // 降级到常见刘海屏数值
    statusBarHeight = 44;
    navigationBarHeight = 44;
  }

  const info: SafeAreaInfo = {
    statusBarHeight,
    navigationBarHeight,
    safeAreaBottom,
  };
  cache.value = info;
  return info;
}
