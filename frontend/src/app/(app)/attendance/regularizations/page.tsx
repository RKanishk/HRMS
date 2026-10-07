import { PageHeader } from '@/components/common/states';
import { RegularizationList } from '@/features/attendance/regularization-list';

export default function Page() {
  return (
    <>
      <PageHeader
        title="Attendance regularizations"
        description="Corrections employees have asked for."
      />
      <RegularizationList scope="all" />
    </>
  );
}
