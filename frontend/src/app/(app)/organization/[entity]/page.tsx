'use client';

import { notFound, useParams } from 'next/navigation';
import { CrudPage } from '@/features/organization/crud-page';
import { findEntity } from '@/features/organization/entities';

export default function Page() {
  const { entity } = useParams<{ entity: string }>();
  const config = findEntity(entity);
  if (!config) notFound();
  return <CrudPage config={config} canEdit showHeader={false} />;
}
