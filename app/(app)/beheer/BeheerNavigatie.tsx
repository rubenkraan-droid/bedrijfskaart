'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { pad: '/beheer', label: 'Onderdelen en relaties' },
  { pad: '/beheer/gebruikers', label: 'Gebruikers en toegang' },
];

export default function BeheerNavigatie() {
  const pad = usePathname();

  return (
    <nav className="border-rand flex gap-1 border-b" aria-label="Beheer">
      {TABS.map(({ pad: doel, label }) => {
        const actief = doel === '/beheer' ? pad === '/beheer' || pad.startsWith('/beheer/onderdeel') : pad === doel;
        return (
          <Link
            key={doel}
            href={doel}
            className={[
              'relative flex min-h-11 items-center px-3 text-sm font-medium transition-colors',
              actief
                ? 'text-groen-800 after:bg-groen-700 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5'
                : 'text-inkt-zacht hover:text-inkt',
            ].join(' ')}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
