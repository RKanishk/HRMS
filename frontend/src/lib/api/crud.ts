import { apiClient } from './client';

export type OrgRow = { id: string } & Record<string, string>;

export interface CrudApi<T extends OrgRow = OrgRow> {
  list: () => Promise<T[]>;
  create: (input: Record<string, string>) => Promise<T>;
  update: (id: string, input: Record<string, string>) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

export function crudApi<T extends OrgRow>(path: string): CrudApi<T> {
  return {
    list: async () => (await apiClient.get<T[]>(path)).data,
    create: async (input) => (await apiClient.post<T>(path, input)).data,
    update: async (id, input) => (await apiClient.patch<T>(`${path}/${id}`, input)).data,
    remove: async (id) => {
      await apiClient.delete(`${path}/${id}`);
    },
  };
}
