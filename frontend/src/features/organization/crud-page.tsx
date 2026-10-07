'use client';

import { useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { OrgRow } from '@/lib/api/crud';
import { getErrorMessage } from '@/lib/api/client';
import { useToast } from '@/providers/toast-provider';
import { Button } from '@/components/ui/button';
import { Field, fieldProps } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/common/states';
import type { EntityConfig } from './entities';
import { orgKey, useOrgList } from './hooks';

function EntityForm({
  config,
  row,
  onClose,
}: {
  config: EntityConfig;
  row: OrgRow | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Record<string, string>>({
    resolver: zodResolver(config.schema as never) as Resolver<Record<string, string>>,
    defaultValues: Object.fromEntries(config.fields.map((f) => [f.name, row?.[f.name] ?? ''])),
  });
  const save = useMutation({
    mutationFn: (v: Record<string, string>) =>
      row ? config.api.update(row.id, v) : config.api.create(v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orgKey(config.key) });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await save.mutateAsync(values);
      toast(
        row
          ? `${config.singular[0].toUpperCase()}${config.singular.slice(1)} updated`
          : `${config.singular[0].toUpperCase()}${config.singular.slice(1)} added`,
      );
      onClose();
    } catch (e) {
      setServerError(getErrorMessage(e, 'Could not save. Your entries are still here.'));
    }
  });
  return (
    <form onSubmit={submit} noValidate aria-busy={isSubmitting} className="space-y-4">
      {serverError && (
        <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">
          {serverError}
        </p>
      )}
      {config.fields.map((f) => (
        <Field
          key={f.name}
          id={`f-${f.name}`}
          label={f.label}
          required
          error={errors[f.name]?.message as string | undefined}
        >
          {f.type === 'select' ? (
            <Select
              {...fieldProps(`f-${f.name}`, errors[f.name]?.message as string)}
              {...register(f.name)}
            >
              <option value="">Select…</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              type={f.type}
              placeholder={f.placeholder}
              {...fieldProps(`f-${f.name}`, errors[f.name]?.message as string)}
              {...register(f.name)}
            />
          )}
        </Field>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : row ? 'Save changes' : `Add ${config.singular}`}
        </Button>
      </div>
    </form>
  );
}

export function CrudPage({
  config,
  canEdit,
  showHeader = true,
}: {
  config: EntityConfig;
  canEdit: boolean;
  showHeader?: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading, isError, error, refetch } = useOrgList(config.key, config.api);
  const [editing, setEditing] = useState<OrgRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<OrgRow | null>(null);
  const rows = useMemo(
    () => (config.sort ? [...(data ?? [])].sort(config.sort) : (data ?? [])),
    [data, config],
  );

  const columns: Column<OrgRow>[] = [
    ...config.columns.map((c) => ({
      key: c.key,
      header: c.header,
      cell: (r: OrgRow) => (c.format ? c.format(r[c.key]) : r[c.key]),
    })),
    ...(canEdit
      ? [
          {
            key: 'actions',
            header: 'Actions',
            cell: (r: OrgRow) => (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Edit ${r.name}`}
                  onClick={() => setEditing(r)}
                >
                  <Pencil aria-hidden className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${r.name}`}
                  onClick={() => setDeleting(r)}
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];
  const card = (r: OrgRow) => (
    <div className="space-y-1">
      {config.columns.map((c, i) => (
        <p key={c.key} className={i === 0 ? 'font-medium' : 'text-sm text-muted'}>
          {c.format ? c.format(r[c.key]) : r[c.key]}
        </p>
      ))}
      {canEdit && (
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleting(r)}>
            Delete
          </Button>
        </div>
      )}
    </div>
  );

  const add = canEdit ? (
    <Button onClick={() => setEditing('new')}>
      <Plus aria-hidden className="h-4 w-4" />
      Add {config.singular}
    </Button>
  ) : undefined;
  return (
    <>
      {showHeader ? (
        <PageHeader title={config.title} description={config.description} actions={add} />
      ) : (
        add && <div className="mb-4 flex justify-end">{add}</div>
      )}
      {isLoading ? (
        <div role="status" aria-label={`Loading ${config.title}`} className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No ${config.title.toLowerCase()} yet`}
          description={
            canEdit ? `Add your first ${config.singular}.` : 'Nothing has been added yet.'
          }
          action={add}
        />
      ) : (
        <DataTable
          caption={config.title}
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          renderCard={card}
        />
      )}

      {editing && (
        <Modal
          open
          onOpenChange={(o) => !o && setEditing(null)}
          title={editing === 'new' ? `Add ${config.singular}` : `Edit ${config.singular}`}
        >
          <EntityForm
            config={config}
            row={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
          />
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDeleting(null)}
          title={`Delete ${config.singular}`}
          confirmLabel="Delete"
          description={`Delete “${deleting.name}”? This can’t be undone.`}
          onConfirm={async () => {
            await config.api.remove(deleting.id);
            void qc.invalidateQueries({ queryKey: orgKey(config.key) });
            toast(`${deleting.name} deleted`);
          }}
        />
      )}
    </>
  );
}
