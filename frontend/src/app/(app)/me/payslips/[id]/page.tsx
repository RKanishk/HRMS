'use client';

import { useParams } from 'next/navigation';
import { PayslipDetail } from '@/features/payroll/payslips';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PayslipDetail id={id} />;
}
