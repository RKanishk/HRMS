import { apiClient } from './client';
import { cleanParams } from './params';
import type {
  AttendanceStatus,
  DailyAttendanceResponse,
  MonthlyAttendanceResponse,
  MyAttendanceResponse,
  Regularization,
  RegularizationInput,
  RequestStatus,
  TeamMember,
} from './types';

export interface DailyParams {
  date: string;
  departmentId?: string;
  branchId?: string;
  status?: AttendanceStatus | '';
  search?: string;
  page?: number;
  pageSize?: number;
}
export interface MonthlyParams {
  month: string;
  departmentId?: string;
  branchId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}
export type Decision = 'approve' | 'reject';

export const attendanceApi = {
  daily: async (p: DailyParams) =>
    (await apiClient.get<DailyAttendanceResponse>('/attendance/daily', { params: cleanParams(p) }))
      .data,
  teamDaily: async (p: DailyParams) =>
    (await apiClient.get<DailyAttendanceResponse>('/team/attendance', { params: cleanParams(p) }))
      .data,
  monthly: async (p: MonthlyParams) =>
    (
      await apiClient.get<MonthlyAttendanceResponse>('/attendance/monthly', {
        params: cleanParams(p),
      })
    ).data,
  mine: async (month: string) =>
    (await apiClient.get<MyAttendanceResponse>('/me/attendance', { params: { month } })).data,
  myRegularizations: async () =>
    (await apiClient.get<Regularization[]>('/me/regularizations')).data,
  requestRegularization: async (input: RegularizationInput) =>
    (await apiClient.post<Regularization>('/me/regularizations', input)).data,
  regularizations: async (status: RequestStatus | '') =>
    (await apiClient.get<Regularization[]>('/regularizations', { params: cleanParams({ status }) }))
      .data,
  teamRegularizations: async (status: RequestStatus | '') =>
    (
      await apiClient.get<Regularization[]>('/team/regularizations', {
        params: cleanParams({ status }),
      })
    ).data,
  decide: async (id: string, decision: Decision, comment: string) =>
    (await apiClient.post<Regularization>(`/regularizations/${id}/${decision}`, { comment })).data,
  teamMembers: async () => (await apiClient.get<TeamMember[]>('/team/members')).data,
};
