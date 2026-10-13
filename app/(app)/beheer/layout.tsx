'use client';

import Kop from '@/components/Kop';
import { Beveiligd, useGebruiker } from '@/lib/auth';
import BeheerNavigatie from './BeheerNavigatie';

export default function BeheerLayout({ children }: LayoutProps<'/beheer'>) {
  return (
    <Beveiligd alleenBeheerder>
      <BeheerFrame>{children}</BeheerFrame>
    </Beveiligd>
  );
}

function BeheerFrame({ children }: { children: React.ReactNode }) {
  const ik = useGebruiker();
  if (!ik) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Kop naam={ik.naam} email={ik.email} isBeheerder />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
          <BeheerNavigatie />
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
