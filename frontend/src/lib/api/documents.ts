import { apiClient } from './client';
import { fetchFile } from './download';
import { cleanParams } from './params';
import type { DocumentStatus, DocumentType, EmployeeDocument, Paginated } from './types';

export interface DocumentParams {
  status?: DocumentStatus | '';
  documentType?: DocumentType | '';
  search?: string;
  page?: number;
  pageSize?: number;
}

export const documentsApi = {
  mine: async () => (await apiClient.get<EmployeeDocument[]>('/me/documents')).data,
  upload: async (file: File, documentType: DocumentType) => {
    const form = new FormData();
    form.append('file', file);
    form.append('documentType', documentType);
    return (await apiClient.post<EmployeeDocument>('/me/documents', form)).data;
  },
  remove: async (id: string) => {
    await apiClient.delete(`/me/documents/${id}`);
  },
  all: async (p: DocumentParams) =>
    (await apiClient.get<Paginated<EmployeeDocument>>('/documents', { params: cleanParams(p) }))
      .data,
  forEmployee: async (employeeId: string) =>
    (await apiClient.get<EmployeeDocument[]>(`/employees/${employeeId}/documents`)).data,
  decide: async (id: string, decision: 'verify' | 'reject', comment: string) =>
    (await apiClient.post<EmployeeDocument>(`/documents/${id}/${decision}`, { comment })).data,
  file: (id: string, fileName: string) => fetchFile(`/documents/${id}/file`, undefined, fileName),
};
