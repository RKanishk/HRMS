import { crudApi } from './crud';
import type { Branch, Department, Designation, Holiday, Shift } from './types';

export const departmentsApi = crudApi<Department>('/departments');
export const designationsApi = crudApi<Designation>('/designations');
export const branchesApi = crudApi<Branch>('/branches');
export const shiftsApi = crudApi<Shift>('/shifts');
export const holidaysApi = crudApi<Holiday>('/holidays');
