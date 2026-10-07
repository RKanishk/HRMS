import { EmptyState, PageHeader } from '@/components/common/states';

export default function NotBuiltYet() {
  return (
    <>
      <PageHeader title="Not built yet" />
      <EmptyState
        title="This screen is scheduled for a later stage"
        description="It is in the navigation so the role structure can be verified, but has no content yet."
      />
    </>
  );
}
