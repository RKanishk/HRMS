'use client';

import { useAuth } from '@/providers/auth-provider';
import { CrudPage } from '@/features/organization/crud-page';
import { HOLIDAYS } from '@/features/organization/entities';

export default function Page() {
  const { user } = useAuth();
  return <CrudPage config={HOLIDAYS} canEdit={user?.role === 'HR_ADMIN'} />;
}
