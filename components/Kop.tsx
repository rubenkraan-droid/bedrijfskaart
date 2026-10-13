'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAanmelding } from '@/lib/auth';

type Props = {
  naam: string | null;
  email: string;
  isBeheerder: boolean;
  /** Middenvak, gebruikt voor de zoekbalk op de kaartpagina. */
  children?: ReactNode;
};

export default function Kop({ naam, email, isBeheerder, children }: Props) {
  const pad = usePathname();
  const opBeheer = pad.startsWith('/beheer');
  const { uitloggen } = useAanmelding();

  return (
    <header className="border-rand bg-paneel z-20 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5 sm:px-5">
      <Link href="/" className="flex shrink-0 items-center gap-2.5">
        <span className="bg-groen-700 flex h-7 w-7 items-center justify-center rounded text-[11px] font-semibold text-white">
          BK
        </span>
        <span className="text-[15px] font-semibold tracking-tight">Bedrijfskaart</span>
      </Link>

      <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
        {children}
      </div>

      <nav className="ml-auto flex shrink-0 items-center gap-1">
        {isBeheerder && (
          <Link
            href={opBeheer ? '/' : '/beheer'}
            className="text-inkt-zacht hover:bg-groen-50 hover:text-groen-800 flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors"
          >
            {opBeheer ? 'Naar de kaart' : 'Beheer'}
          </Link>
        )}

        <Link
          href="/account"
          title={`${email} · mijn account`}
          className="text-inkt-zacht hover:bg-groen-50 hover:text-groen-800 flex max-w-28 min-h-11 items-center truncate rounded-md px-2.5 text-sm transition-colors sm:max-w-40 sm:px-3"
        >
          {naam || email}
        </Link>

        <button
          type="button"
          onClick={() => void uitloggen()}
          className="text-inkt-zacht hover:bg-groen-50 hover:text-groen-800 flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors"
        >
          Uitloggen
        </button>
      </nav>
    </header>
  );
}
