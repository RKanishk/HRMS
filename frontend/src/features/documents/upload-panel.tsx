'use client';

import { useRef, useState, type DragEvent } from 'react';
import { UploadCloud } from 'lucide-react';
import { getErrorMessage } from '@/lib/api/client';
import type { DocumentType } from '@/lib/api/types';
import { useToast } from '@/providers/toast-provider';
import { Button } from '@/components/ui/button';
import { Field, fieldProps } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DOC_TYPES, formatBytes } from './document-table';
import { useUploadDocument } from './hooks';

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_BYTES = 5 * 1024 * 1024;
/** Client-side check for quick feedback only; the server validates again. */
export const validateFile = (f: File) =>
  !ACCEPTED.includes(f.type)
    ? 'Only PDF, JPG or PNG files are accepted.'
    : f.size > MAX_BYTES
      ? 'The file is larger than 5 MB.'
      : null;

export function UploadPanel() {
  const upload = useUploadDocument();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<DocumentType | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [pending, setPending] = useState(false);

  const pick = (f: File | undefined) => {
    if (!f) return;
    const problem = validateFile(f);
    setError(problem);
    setFile(problem ? null : f);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    pick(e.dataTransfer.files[0]);
  };
  const submit = async () => {
    if (!file || !type) return;
    setPending(true);
    setError(null);
    try {
      await upload.mutateAsync({ file, documentType: type });
      toast('Document uploaded for review');
      setFile(null);
      setType('');
      if (input.current) input.current.value = '';
    } catch (e) {
      setError(getErrorMessage(e, 'Upload failed. Your file is still selected.'));
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      aria-label="Upload a document"
      className="mb-8 rounded-lg border border-line bg-surface p-4"
    >
      <h2 className="mb-3 font-semibold">Upload a document</h2>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          'relative rounded-lg border-2 border-dashed p-6 text-center transition-colors focus-within:border-ink',
          over ? 'border-brand bg-brand/10' : 'border-line',
        )}
      >
        <UploadCloud aria-hidden className="mx-auto mb-2 h-8 w-8 text-muted" />
        <label htmlFor="doc-file" className="cursor-pointer text-sm">
          Drag a file here or <span className="font-medium underline">choose a file</span>
          <input
            ref={input}
            id="doc-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
        <p className="mt-1 text-xs text-muted">PDF, JPG or PNG, up to 5 MB</p>
        {file && (
          <p className="mt-3 text-sm font-medium">
            {file.name} <span className="font-normal text-muted">({formatBytes(file.size)})</span>
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-md bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field id="doc-type" label="Document type" required>
          <Select
            {...fieldProps('doc-type')}
            value={type}
            onChange={(e) => setType(e.target.value as DocumentType | '')}
          >
            <option value="">Select…</option>
            {(Object.keys(DOC_TYPES) as DocumentType[]).map((t) => (
              <option key={t} value={t}>
                {DOC_TYPES[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Button onClick={() => void submit()} disabled={!file || !type || pending}>
          {pending ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
    </section>
  );
}
