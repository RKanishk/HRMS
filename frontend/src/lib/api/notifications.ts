import { apiClient } from './client';
import type { NotificationsResponse } from './types';

export const notificationsApi = {
  list: async (limit = 20) =>
    (await apiClient.get<NotificationsResponse>('/notifications', { params: { limit } })).data,
  markRead: async (id: string) => {
    await apiClient.post(`/notifications/${id}/read`);
  },
  markAllRead: async () => {
    await apiClient.post('/notifications/read-all');
  },
};
