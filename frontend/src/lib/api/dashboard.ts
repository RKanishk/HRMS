import { apiClient } from './client';
import type { HrDashboard } from './types';

export const dashboardApi = {
  hr: async () => (await apiClient.get<HrDashboard>('/dashboard/hr')).data,
};
