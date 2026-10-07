'use client';

import { useState } from 'react';
import { getErrorMessage } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {error && (
        <p role="alert" className="mb-4 rounded-md bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancel
        </Button>
        <Button variant="danger" onClick={() => void run()} disabled={pending}>
          {pending ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
