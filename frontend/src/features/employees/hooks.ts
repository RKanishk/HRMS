import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi, type EmployeeListParams } from '@/lib/api/employees';
import type { EmployeeInput } from '@/lib/api/types';

export const employeeKeys = {
  all: ['employees'] as const,
  list: (p: EmployeeListParams) => ['employees', 'list', p] as const,
  detail: (id: string) => ['employees', 'detail', id] as const,
};

export const useEmployees = (params: EmployeeListParams, enabled = true) =>
  useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: () => employeesApi.list(params),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useEmployee = (id: string | null | undefined) =>
  useQuery({
    queryKey: employeeKeys.detail(id ?? ''),
    queryFn: () => employeesApi.get(id!),
    enabled: !!id,
  });

export function useSaveEmployee(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeeInput) =>
      id ? employeesApi.update(id, input) : employeesApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: employeeKeys.all });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
