import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { payrollApi, type EntryParams, type PayrollAction } from '@/lib/api/payroll';

export const usePayrollPeriods = () =>
  useQuery({ queryKey: ['payroll', 'periods'], queryFn: payrollApi.periods });
export const usePayrollPeriod = (id: string) =>
  useQuery({ queryKey: ['payroll', 'period', id], queryFn: () => payrollApi.period(id) });
export const usePayrollEntries = (id: string, p: EntryParams) =>
  useQuery({
    queryKey: ['payroll', 'entries', id, p],
    queryFn: () => payrollApi.entries(id, p),
    placeholderData: keepPreviousData,
  });
export const usePayslips = () => useQuery({ queryKey: ['payslips'], queryFn: payrollApi.payslips });
export const usePayslip = (id: string) =>
  useQuery({ queryKey: ['payslips', id], queryFn: () => payrollApi.payslip(id) });

const refresh = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ['payroll'] });
  void qc.invalidateQueries({ queryKey: ['reports'] });
  void qc.invalidateQueries({ queryKey: ['notifications'] });
};
export function useCreateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (month: string) => payrollApi.createRun(month),
    onSuccess: () => refresh(qc),
  });
}
export function usePayrollAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: PayrollAction) => payrollApi.act(id, a),
    onSuccess: () => refresh(qc),
  });
}
