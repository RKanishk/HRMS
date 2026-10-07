import { apiClient } from './client';
import { fetchFile } from './download';
import { cleanParams } from './params';
import type { ReportKind, ReportResponse } from './types';

export interface ReportParams {
  departmentId?: string;
  branchId?: string;
  leaveTypeId?: string;
  from?: string;
  to?: string;
  periodId?: string;
}

export const reportsApi = {
  get: async (kind: ReportKind, p: ReportParams) =>
    (await apiClient.get<ReportResponse>(`/reports/${kind}`, { params: cleanParams(p) })).data,
  export: (kind: ReportKind, format: 'csv' | 'xlsx', p: ReportParams) =>
    fetchFile(`/reports/${kind}/export`, { ...cleanParams(p), format }, `${kind}-report.${format}`),
};
