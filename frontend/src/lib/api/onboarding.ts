import { apiClient } from './client';
import type { ChecklistProcess } from './types';

export type ProcessKind = 'onboarding' | 'offboarding';

export const processApi = {
  list: async (kind: ProcessKind) => (await apiClient.get<ChecklistProcess[]>(`/${kind}`)).data,
  complete: async (kind: ProcessKind, processId: string, itemId: string) =>
    (await apiClient.post<ChecklistProcess>(`/${kind}/${processId}/items/${itemId}/complete`)).data,
};
