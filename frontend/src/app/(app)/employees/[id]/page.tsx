'use client';

import { useParams } from 'next/navigation';
import { EmployeeProfile } from '@/features/employees/employee-profile';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <EmployeeProfile id={id} />;
}
