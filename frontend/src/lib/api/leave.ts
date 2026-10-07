import { apiClient } from './client';
import { crudApi } from './crud';
import { cleanParams } from './params';
import type { Decision } from './attendance';
import type {
  LeaveBalance,
  LeaveCalendarEntry,
  LeaveInput,
  LeavePreview,
  LeaveRequest,
  LeaveType,
  Paginated,
  RequestStatus,
} from './types';

export interface LeaveRequestParams {
  status?: RequestStatus | '';
  departmentId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const leaveTypesApi = crudApi<LeaveType>('/leave-types');
export const leaveApi = {
  balances: async () => (await apiClient.get<LeaveBalance[]>('/me/leave/balances')).data,
  mine: async () => (await apiClient.get<LeaveRequest[]>('/me/leave')).data,
  preview: async (p: Omit<LeaveInput, 'reason'>) =>
    (await apiClient.get<LeavePreview>('/leave/preview', { params: p })).data,
  apply: async (input: LeaveInput) => (await apiClient.post<LeaveRequest>('/me/leave', input)).data,
  cancel: async (id: string) => {
    await apiClient.post(`/me/leave/${id}/cancel`);
  },
  requests: async (p: LeaveRequestParams) =>
    (await apiClient.get<Paginated<LeaveRequest>>('/leave/requests', { params: cleanParams(p) }))
      .data,
  teamRequests: async (p: LeaveRequestParams) =>
    (
      await apiClient.get<Paginated<LeaveRequest>>('/team/leave/requests', {
        params: cleanParams(p),
      })
    ).data,
  decide: async (id: string, decision: Decision, comment: string) =>
    (await apiClient.post<LeaveRequest>(`/leave/requests/${id}/${decision}`, { comment })).data,
  calendar: async (month: string) =>
    (await apiClient.get<LeaveCalendarEntry[]>('/leave/calendar', { params: { month } })).data,
  teamCalendar: async (month: string) =>
    (await apiClient.get<LeaveCalendarEntry[]>('/team/leave/calendar', { params: { month } })).data,
};
