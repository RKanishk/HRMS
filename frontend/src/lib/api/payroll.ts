import { apiClient } from './client';
import { fetchFile } from './download';
import { cleanParams } from './params';
import type {
  Paginated,
  PayrollEntry,
  PayrollPeriod,
  PayrollPeriodDetail,
  Payslip,
  PayslipSummary,
} from './types';

export type PayrollAction = 'submit' | 'approve' | 'lock';
export interface EntryParams {
  search?: string;
  departmentId?: string;
  page?: number;
  pageSize?: number;
}

export const payrollApi = {
  periods: async () => (await apiClient.get<PayrollPeriod[]>('/payroll/periods')).data,
  period: async (id: string) =>
    (await apiClient.get<PayrollPeriodDetail>(`/payroll/periods/${id}`)).data,
  createRun: async (month: string) =>
    (await apiClient.post<PayrollPeriod>('/payroll/periods', { month })).data,
  entries: async (id: string, p: EntryParams) =>
    (
      await apiClient.get<Paginated<PayrollEntry>>(`/payroll/periods/${id}/entries`, {
        params: cleanParams(p),
      })
    ).data,
  act: async (id: string, action: PayrollAction) =>
    (await apiClient.post<PayrollPeriod>(`/payroll/periods/${id}/${action}`)).data,
  payslips: async () => (await apiClient.get<PayslipSummary[]>('/me/payslips')).data,
  payslip: async (id: string) => (await apiClient.get<Payslip>(`/me/payslips/${id}`)).data,
  downloadPayslip: (id: string, month: string) =>
    fetchFile(`/me/payslips/${id}/download`, undefined, `payslip-${month}.pdf`),
};
