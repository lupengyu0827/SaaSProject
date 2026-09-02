/** PC 媒体监管接口：仅查询租户媒体状态，不暴露对象存储路径。 */
import type { MediaAdminListQuery, MediaAdminListResponse } from '@saas/contracts';

import { requestMediaApi } from '../client';

export function listMediaAssets(query: MediaAdminListQuery): Promise<MediaAdminListResponse> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  return requestMediaApi(`/admin/assets?${params.toString()}`);
}
