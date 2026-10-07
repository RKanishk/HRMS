'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import type { EmployeeListItem, EmployeeStatus } from '@/lib/api/types';
import { getErrorMessage } from '@/lib/api/client';
import { STATUS_META, formatDate, fullName } from '@/lib/format';
import { Button, buttonVariants } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmployeeAvatar } from '@/components/common/employee-avatar';
import { Pagination } from '@/components/common/pagination';
import { SearchInput } from '@/components/common/search-input';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@/components/common/states';
import { useBranches, useDepartments, useDesignations } from '@/features/organization/hooks';
import { useEmployees } from './hooks';

interface Filters {
  search: string;
  departmentId: string;
  designationId: string;
  branchId: string;
  status: '' | EmployeeStatus;
  sort: string;
  order: 'asc' | 'desc';
  page: number;
}
const PAGE_SIZE = 10;

export function EmployeesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => ({
    search: sp.get('search') ?? '',
    departmentId: sp.get('departmentId') ?? '',
    designationId: sp.get('designationId') ?? '',
    branchId: sp.get('branchId') ?? '',
    status: (sp.get('status') ?? '') as Filters['status'],
    sort: sp.get('sort') ?? 'employeeCode',
    order: sp.get('order') === 'desc' ? 'desc' : 'asc',
    page: Number(sp.get('page')) || 1,
  }));
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const qs = new URLSearchParams();
    (Object.entries(filters) as [string, string | number][]).forEach(([k, v]) => {
      if (
        v !== '' &&
        !(k === 'page' && v === 1) &&
        !(k === 'sort' && v === 'employeeCode') &&
        !(k === 'order' && v === 'asc')
      )
        qs.set(k, String(v));
    });
    router.replace(qs.size ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [filters, pathname, router]);

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, page: 1, ...patch }));
  const onSort = (key: string) =>
    set({ sort: key, order: filters.sort === key && filters.order === 'asc' ? 'desc' : 'asc' });
  const hasFilters = !!(
    filters.search ||
    filters.departmentId ||
    filters.designationId ||
    filters.branchId ||
    filters.status
  );
  const clear = () => {
    setFilters((f) => ({
      ...f,
      search: '',
      departmentId: '',
      designationId: '',
      branchId: '',
      status: '',
      page: 1,
    }));
    setResetKey((k) => k + 1);
  };

  const departments = useDepartments().data ?? [];
  const designations = useDesignations().data ?? [];
  const branches = useBranches().data ?? [];
  const { data, isLoading, isError, error, refetch, isFetching } = useEmployees({
    ...filters,
    pageSize: PAGE_SIZE,
  });

  const columns = useMemo<Column<EmployeeListItem>[]>(
    () => [
      {
        key: 'code',
        header: 'Employee code',
        sortKey: 'employeeCode',
        cell: (e) => <span className="font-mono text-xs">{e.employeeCode}</span>,
      },
      {
        key: 'name',
        header: 'Employee',
        sortKey: 'name',
        cell: (e) => (
          <div className="flex items-center gap-3">
            <EmployeeAvatar firstName={e.firstName} lastName={e.lastName} />
            <div className="min-w-0">
              <Link href={`/employees/${e.id}`} className="font-medium hover:underline">
                {fullName(e)}
              </Link>
              <p className="truncate text-xs text-muted">{e.email}</p>
            </div>
          </div>
        ),
      },
      { key: 'dept', header: 'Department', sortKey: 'department', cell: (e) => e.departmentName },
      {
        key: 'desig',
        header: 'Designation',
        sortKey: 'designation',
        cell: (e) => e.designationName,
      },
      { key: 'branch', header: 'Branch', sortKey: 'branch', cell: (e) => e.branchName },
      { key: 'mgr', header: 'Manager', cell: (e) => e.managerName ?? '—' },
      {
        key: 'join',
        header: 'Joining date',
        sortKey: 'joiningDate',
        cell: (e) => formatDate(e.joiningDate),
        className: 'whitespace-nowrap',
      },
      {
        key: 'status',
        header: 'Status',
        sortKey: 'status',
        cell: (e) => (
          <StatusBadge label={STATUS_META[e.status].label} tone={STATUS_META[e.status].tone} />
        ),
      },
      {
        key: 'act',
        header: 'Actions',
        cell: (e) => (
          <div className="flex gap-1">
            <Link
              href={`/employees/${e.id}`}
              aria-label={`View ${fullName(e)}`}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              View
            </Link>
            <Link
              href={`/employees/${e.id}/edit`}
              aria-label={`Edit ${fullName(e)}`}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              Edit
            </Link>
          </div>
        ),
      },
    ],
    [],
  );

  const card = (e: EmployeeListItem) => (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <EmployeeAvatar firstName={e.firstName} lastName={e.lastName} />
          <div>
            <Link href={`/employees/${e.id}`} className="font-medium">
              {fullName(e)}
            </Link>
            <p className="text-xs text-muted">{e.employeeCode}</p>
          </div>
        </div>
        <StatusBadge label={STATUS_META[e.status].label} tone={STATUS_META[e.status].tone} />
      </div>
      <p className="text-sm">
        {e.designationName} · {e.departmentName}
      </p>
      <p className="text-xs text-muted">
        {e.branchName} · Joined {formatDate(e.joiningDate)}
      </p>
      <Link
        href={`/employees/${e.id}/edit`}
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
      >
        Edit
      </Link>
    </div>
  );

  const opts = (list: { id: string; name: string }[]) =>
    list.map((o) => (
      <option key={o.id} value={o.id}>
        {o.name}
      </option>
    ));

  return (
    <>
      <PageHeader
        title="Employees"
        description="Search, filter and manage everyone at CIPL."
        actions={
          <Link href="/employees/new" className={buttonVariants()}>
            <Plus aria-hidden className="h-4 w-4" />
            Add employee
          </Link>
        }
      />
      <div
        role="search"
        aria-label="Employee filters"
        className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="sm:col-span-2 lg:col-span-1">
          <SearchInput
            key={resetKey}
            initialValue={filters.search}
            onSearch={(v) => set({ search: v })}
            label="Search employees"
            placeholder="Search name, code or email"
          />
        </div>
        <Select
          aria-label="Department"
          value={filters.departmentId}
          onChange={(e) => set({ departmentId: e.target.value })}
        >
          <option value="">All departments</option>
          {opts(departments)}
        </Select>
        <Select
          aria-label="Designation"
          value={filters.designationId}
          onChange={(e) => set({ designationId: e.target.value })}
        >
          <option value="">All designations</option>
          {opts(designations)}
        </Select>
        <Select
          aria-label="Branch"
          value={filters.branchId}
          onChange={(e) => set({ branchId: e.target.value })}
        >
          <option value="">All branches</option>
          {opts(branches)}
        </Select>
        <Select
          aria-label="Status"
          value={filters.status}
          onChange={(e) => set({ status: e.target.value as Filters['status'] })}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_NOTICE">On notice</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" className="mb-3" onClick={clear}>
          Clear filters
        </Button>
      )}

      {isLoading ? (
        <div className="space-y-2" role="status" aria-label="Loading employees">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : data && data.data.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No employees match these filters' : 'No employees yet'}
          description={
            hasFilters
              ? 'Try a different search or remove a filter.'
              : 'Add the first employee to get started.'
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={clear}>
                Clear filters
              </Button>
            ) : (
              <Link href="/employees/new" className={buttonVariants()}>
                Add employee
              </Link>
            )
          }
        />
      ) : data ? (
        <div
          aria-busy={isFetching}
          className={isFetching ? 'opacity-70 transition-opacity' : undefined}
        >
          <DataTable
            caption="Employees"
            columns={columns}
            rows={data.data}
            getRowId={(e) => e.id}
            renderCard={card}
            sort={{ key: filters.sort, order: filters.order }}
            onSort={onSort}
          />
          <Pagination {...data.meta} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
        </div>
      ) : null}
    </>
  );
}
