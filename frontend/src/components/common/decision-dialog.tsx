'use client';

import { useState, type ReactNode } from 'react';
import { getErrorMessage } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Field, fieldProps } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';

/** Confirmation step for approve/reject. Rejecting requires a reason. */
export function DecisionDialog({
  decision,
  title,
  summary,
  onClose,
  onConfirm,
  confirmLabel,
}: {
  decision: 'approve' | 'reject';
  title: string;
  summary: ReactNode;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void>;
  confirmLabel?: string;
}) {
  const [comment, setComment] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const reject = decision === 'reject';

  const submit = async () => {
    if (reject && comment.trim().length < 3) return setFieldError('Enter a reason for rejecting');
    setFieldError(undefined);
    setError(null);
    setPending(true);
    try {
      await onConfirm(comment.trim());
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
      setPending(false);
    }
  };

  return (
    <Modal open onOpenChange={(o) => !o && !pending && onClose()} title={title}>
      <div className="mb-4 text-sm">{summary}</div>
      {error && (
        <p role="alert" className="mb-4 rounded-md bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <Field
        id="decision-comment"
        label={reject ? 'Reason' : 'Comment (optional)'}
        required={reject}
        error={fieldError}
      >
        <Textarea
          {...fieldProps('decision-comment', fieldError)}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </Field>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant={reject ? 'danger' : 'primary'}
          onClick={() => void submit()}
          disabled={pending}
        >
          {pending ? 'Saving…' : (confirmLabel ?? (reject ? 'Reject request' : 'Approve request'))}
        </Button>
      </div>
    </Modal>
  );
}
