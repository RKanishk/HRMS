'use client';

import { useParams } from 'next/navigation';
import { EditEmployeePage } from '@/features/employees/employee-pages';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <EditEmployeePage id={id} />;
}
