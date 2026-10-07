import { apiClient } from './client';
import type { Employee, EmployeeInput, EmployeeListItem, EmployeeStatus, Paginated } from './types';

export interface EmployeeListParams {
  search?: string;
  departmentId?: string;
  designationId?: string;
  branchId?: string;
  status?: EmployeeStatus | '';
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

const clean = (p: EmployeeListParams) =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== ''));

export const employeesApi = {
  list: async (params: EmployeeListParams) =>
    (await apiClient.get<Paginated<EmployeeListItem>>('/employees', { params: clean(params) }))
      .data,
  get: async (id: string) => (await apiClient.get<EmployeeListItem>(`/employees/${id}`)).data,
  create: async (input: EmployeeInput) =>
    (await apiClient.post<Employee>('/employees', input)).data,
  update: async (id: string, input: EmployeeInput) =>
    (await apiClient.patch<Employee>(`/employees/${id}`, input)).data,
};
