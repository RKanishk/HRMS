import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  attendanceApi,
  type DailyParams,
  type Decision,
  type MonthlyParams,
} from '@/lib/api/attendance';
import type { RegularizationInput, RequestStatus } from '@/lib/api/types';

export type Scope = 'all' | 'team';

export const useDailyAttendance = (scope: Scope, p: DailyParams) =>
  useQuery({
    queryKey: ['attendance', scope, 'daily', p],
    queryFn: () => (scope === 'team' ? attendanceApi.teamDaily(p) : attendanceApi.daily(p)),
    placeholderData: keepPreviousData,
  });
export const useMonthlyAttendance = (p: MonthlyParams) =>
  useQuery({
    queryKey: ['attendance', 'monthly', p],
    queryFn: () => attendanceApi.monthly(p),
    placeholderData: keepPreviousData,
  });
export const useMyAttendance = (month: string) =>
  useQuery({ queryKey: ['attendance', 'mine', month], queryFn: () => attendanceApi.mine(month) });
export const useMyRegularizations = () =>
  useQuery({ queryKey: ['regularizations', 'mine'], queryFn: attendanceApi.myRegularizations });
export const useRegularizations = (scope: Scope, status: RequestStatus | '') =>
  useQuery({
    queryKey: ['regularizations', scope, status],
    queryFn: () =>
      scope === 'team'
        ? attendanceApi.teamRegularizations(status)
        : attendanceApi.regularizations(status),
  });
export const useTeamMembers = () =>
  useQuery({ queryKey: ['team', 'members'], queryFn: attendanceApi.teamMembers });

export function useRequestRegularization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: RegularizationInput) => attendanceApi.requestRegularization(i),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['regularizations'] }),
  });
}
export function useDecideRegularization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; decision: Decision; comment: string }) =>
      attendanceApi.decide(v.id, v.decision, v.comment),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['regularizations'] });
      void qc.invalidateQueries({ queryKey: ['attendance'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
