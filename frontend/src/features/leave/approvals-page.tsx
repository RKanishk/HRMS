'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { RegularizationList } from '@/features/attendance/regularization-list';
import { LeaveRequests } from './leave-requests';

export function ApprovalsPage() {
  const [tab, setTab] = useState<'leave' | 'reg'>('leave');
  return (
    <>
      <PageHeader title="Approvals" description="Requests from your team that need a decision." />
      <div role="group" aria-label="Approval type" className="mb-5 flex gap-2">
        <Button
          variant={tab === 'leave' ? 'primary' : 'outline'}
          aria-pressed={tab === 'leave'}
          onClick={() => setTab('leave')}
        >
          Leave requests
        </Button>
        <Button
          variant={tab === 'reg' ? 'primary' : 'outline'}
          aria-pressed={tab === 'reg'}
          onClick={() => setTab('reg')}
        >
          Attendance regularizations
        </Button>
      </div>
      {tab === 'leave' ? <LeaveRequests scope="team" /> : <RegularizationList scope="team" />}
    </>
  );
}
