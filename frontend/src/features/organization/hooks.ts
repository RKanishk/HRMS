import { useQuery } from '@tanstack/react-query';
import type { CrudApi, OrgRow } from '@/lib/api/crud';
import {
  branchesApi,
  departmentsApi,
  designationsApi,
  holidaysApi,
  shiftsApi,
} from '@/lib/api/organization';

export const orgKey = (key: string) => ['org', key] as const;

export function useOrgList<T extends OrgRow>(key: string, api: CrudApi<T>) {
  return useQuery({ queryKey: orgKey(key), queryFn: api.list, staleTime: 5 * 60_000 });
}

export const useDepartments = () => useOrgList('departments', departmentsApi);
export const useDesignations = () => useOrgList('designations', designationsApi);
export const useBranches = () => useOrgList('branches', branchesApi);
export const useShifts = () => useOrgList('shifts', shiftsApi);
export const useHolidays = () => useOrgList('holidays', holidaysApi);
