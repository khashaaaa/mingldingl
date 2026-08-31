import { api } from './api';
import type { components } from './api.generated';

type Schemas = components['schemas'];

function query(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const apiClient = {
  auth: {
    login: (username: string, password: string) =>
      api.post<Schemas['AdminLoginResponse']>('/admin/auth/login', { username, password }).then((r) => r.data),
  },
  users: {
    list: (search: string, page: number, pageSize = 20) =>
      api
        .get<Schemas['AdminUserListItemDtoPagedResponse']>(`/admin/users${query({ search, page, pageSize })}`)
        .then((r) => r.data),
    detail: (id: string) => api.get<Schemas['AdminUserDetailDto']>(`/admin/users/${id}`).then((r) => r.data),
    deletionRequests: () =>
      api.get<Schemas['AdminDeletionRequestDto'][]>('/admin/users/deletion-requests').then((r) => r.data),
    ban: (id: string, reason: string) =>
      api.post<Schemas['AdminUserDetailDto']>(`/admin/users/${id}/ban`, { reason }).then((r) => r.data),
    unban: (id: string) => api.post<Schemas['AdminUserDetailDto']>(`/admin/users/${id}/unban`).then((r) => r.data),
    cancelDeletion: (id: string) =>
      api.post<Schemas['AdminUserDetailDto']>(`/admin/users/${id}/cancel-deletion`).then((r) => r.data),
    adjustScore: (id: string, delta: number, reason: string) =>
      api.post<Schemas['AdminUserDetailDto']>(`/admin/users/${id}/adjust-score`, { delta, reason }).then((r) => r.data),
    resetNoShow: (id: string) =>
      api.post<Schemas['AdminUserDetailDto']>(`/admin/users/${id}/reset-noshow`).then((r) => r.data),
    export: (search: string) =>
      api.get(`/admin/users/export${query({ search })}`, { responseType: 'blob' }).then((r) => r.data as Blob),
  },
  content: {
    list: () => api.get<Schemas['ContentPageResponse'][]>('/admin/content').then((r) => r.data),
    update: (slug: string, body: Schemas['AdminUpdateContentPageRequest']) =>
      api.put<Schemas['ContentPageResponse']>(`/admin/content/${slug}`, body).then((r) => r.data),
  },
  business: {
    list: (search: string, page: number, pageSize = 20) =>
      api
        .get<Schemas['BusinessResponsePagedResponse']>(`/admin/business${query({ search, page, pageSize })}`)
        .then((r) => r.data),
    detail: (id: string) => api.get<Schemas['BusinessResponse']>(`/admin/business/${id}`).then((r) => r.data),
    create: (body: Schemas['AdminCreateBusinessRequest']) =>
      api.post<Schemas['BusinessResponse']>('/admin/business', body).then((r) => r.data),
    update: (id: string, body: Schemas['AdminUpdateBusinessRequest']) =>
      api.put<Schemas['BusinessResponse']>(`/admin/business/${id}`, body).then((r) => r.data),
    remove: (id: string) => api.delete(`/admin/business/${id}`).then(() => undefined),
    bulkUpdate: (body: Schemas['AdminBulkUpdateBusinessRequest']) =>
      api.post<{ updated: number }>('/admin/business/bulk-update', body).then((r) => r.data),
    export: (search: string) =>
      api.get(`/admin/business/export${query({ search })}`, { responseType: 'blob' }).then((r) => r.data as Blob),
  },
  analytics: {
    overview: () => api.get<Schemas['AdminAnalyticsOverviewResponse']>('/admin/analytics/overview').then((r) => r.data),
  },
  ops: {
    runMaintenanceSweep: () => api.post('/admin/ops/run-maintenance-sweep').then((r) => r.data),
    pricing: () => api.get<Schemas['MembershipTierResponse'][]>('/admin/ops/pricing').then((r) => r.data),
  },
  auditLog: {
    list: (page: number, pageSize = 20) =>
      api.get<Schemas['AdminAuditLogDtoPagedResponse']>(`/admin/audit-log${query({ page, pageSize })}`).then((r) => r.data),
  },
  config: {
    list: () => api.get<Schemas['AdminConfigDto'][]>('/admin/config').then((r) => r.data),
    update: (key: string, value: string) =>
      api.put<Schemas['AdminConfigDto']>(`/admin/config/${key}`, { value }).then((r) => r.data),
    revert: (key: string) =>
      api.post<Schemas['AdminConfigDto']>(`/admin/config/${key}/revert`).then((r) => r.data),
  },
  ships: {
    list: (status: string, page: number, pageSize = 20) =>
      api
        .get<Schemas['AdminShipListItemDtoPagedResponse']>(`/admin/ships${query({ status, page, pageSize })}`)
        .then((r) => r.data),
  },
  townSquare: {
    sessions: (page: number, pageSize = 20) =>
      api
        .get<Schemas['AdminTownSquareSessionDtoPagedResponse']>(`/admin/townsquare/sessions${query({ page, pageSize })}`)
        .then((r) => r.data),
    pairings: (sessionId: string) =>
      api.get<Schemas['AdminTownSquarePairingDto'][]>(`/admin/townsquare/sessions/${sessionId}/pairings`).then((r) => r.data),
    createSession: (body: Schemas['CreateTownSquareSessionRequest']) =>
      api.post<Schemas['AdminTownSquareSessionDto']>('/admin/townsquare/sessions', body).then((r) => r.data),
    cancelSession: (sessionId: string) =>
      api.post<Schemas['AdminTownSquareSessionDto']>(`/admin/townsquare/sessions/${sessionId}/cancel`).then((r) => r.data),
  },
};
