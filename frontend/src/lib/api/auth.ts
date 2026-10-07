import { apiClient } from './client';
import { toCurrentUser } from './roles';

export const authApi = {
  login: async (input: { email: string; password: string }) =>
    toCurrentUser((await apiClient.post<unknown>('/auth/login', input)).data),
  me: async () => toCurrentUser((await apiClient.get<unknown>('/auth/me')).data),
  logout: async () => {
    await apiClient.post('/auth/logout');
  },
};
