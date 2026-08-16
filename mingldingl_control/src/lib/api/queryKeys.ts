export const queryKeys = {
  users: (search: string, page: number) => ['users', search, page] as const,
  user: (id: string) => ['user', id] as const,
  deletionRequests: ['deletionRequests'] as const,
  content: ['content'] as const,
  business: (search: string, page: number) => ['business', search, page] as const,
  businessDetail: (id: string) => ['businessDetail', id] as const,
  analyticsOverview: ['analyticsOverview'] as const,
  pricing: ['pricing'] as const,
  auditLog: (page: number) => ['auditLog', page] as const,
  config: ['config'] as const,
};
