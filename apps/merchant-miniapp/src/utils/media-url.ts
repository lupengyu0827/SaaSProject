/** 媒体/商品图片 URL 解析：后端返回相对路径，需拼接 Gateway 基础地址才能被 <image>/<video> 加载。 */
import { getMerchantApiBaseUrl } from '../config/runtime';

/** 将相对媒体路径转换为可被 <image>/<video> 加载的绝对地址；绝对地址与静态资源原样返回。 */
export function absoluteMediaUrl(path: string): string {
  if (!path || path.startsWith('http') || path.startsWith('/static/')) return path;
  return `${getMerchantApiBaseUrl()}${path.replace(/^\/api/, '')}`;
}
