'use client';

import { CrudPage } from '@/features/organization/crud-page';
import { LEAVE_TYPES } from '@/features/organization/entities';

export default function Page() {
  return <CrudPage config={LEAVE_TYPES} canEdit showHeader={false} />;
}
