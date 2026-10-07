import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsApi, type DocumentParams } from '@/lib/api/documents';
import type { DocumentType } from '@/lib/api/types';

export const useMyDocuments = () =>
  useQuery({ queryKey: ['documents', 'mine'], queryFn: documentsApi.mine });
export const useDocuments = (p: DocumentParams) =>
  useQuery({
    queryKey: ['documents', 'all', p],
    queryFn: () => documentsApi.all(p),
    placeholderData: keepPreviousData,
  });
export const useEmployeeDocuments = (id: string) =>
  useQuery({
    queryKey: ['documents', 'employee', id],
    queryFn: () => documentsApi.forEmployee(id),
  });

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { file: File; documentType: DocumentType }) =>
      documentsApi.upload(v.file, v.documentType),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}
export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}
export function useDecideDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; decision: 'verify' | 'reject'; comment: string }) =>
      documentsApi.decide(v.id, v.decision, v.comment),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['documents'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
