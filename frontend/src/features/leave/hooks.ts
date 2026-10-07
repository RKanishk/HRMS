import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Decision } from '@/lib/api/attendance';
import { leaveApi, leaveTypesApi, type LeaveRequestParams } from '@/lib/api/leave';
import type { LeaveInput } from '@/lib/api/types';
import { useOrgList } from '@/features/organization/hooks';
import type { Scope } from '@/features/attendance/hooks';

export const useLeaveTypes = () => useOrgList('leave-types', leaveTypesApi);
export const useLeaveBalances = () =>
  useQuery({ queryKey: ['leave', 'balances'], queryFn: leaveApi.balances });
export const useMyLeave = () => useQuery({ queryKey: ['leave', 'mine'], queryFn: leaveApi.mine });
export const useLeavePreview = (p: Omit<LeaveInput, 'reason'>, enabled: boolean) =>
  useQuery({
    queryKey: ['leave', 'preview', p],
    queryFn: () => leaveApi.preview(p),
    enabled,
    retry: false,
  });
export const useLeaveRequests = (scope: Scope, p: LeaveRequestParams) =>
  useQuery({
    queryKey: ['leave', scope, 'requests', p],
    queryFn: () => (scope === 'team' ? leaveApi.teamRequests(p) : leaveApi.requests(p)),
    placeholderData: keepPreviousData,
  });
export const useLeaveCalendar = (scope: Scope, month: string) =>
  useQuery({
    queryKey: ['leave', scope, 'calendar', month],
    queryFn: () => (scope === 'team' ? leaveApi.teamCalendar(month) : leaveApi.calendar(month)),
  });

const refresh = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ['leave'] });
  void qc.invalidateQueries({ queryKey: ['attendance'] });
  void qc.invalidateQueries({ queryKey: ['dashboard'] });
};
export function useApplyLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: LeaveInput) => leaveApi.apply(i),
    onSuccess: () => refresh(qc),
  });
}
export function useCancelLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leaveApi.cancel(id),
    onSuccess: () => refresh(qc),
  });
}
export function useDecideLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; decision: Decision; comment: string }) =>
      leaveApi.decide(v.id, v.decision, v.comment),
    onSuccess: () => refresh(qc),
  });
}
