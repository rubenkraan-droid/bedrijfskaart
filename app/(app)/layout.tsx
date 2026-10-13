'use client';

import { Beveiligd } from '@/lib/auth';

/** Alles achter de inlog. */
export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <Beveiligd>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </Beveiligd>
  );
}
