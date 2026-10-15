'use client';

import { useEffect, useRef, useState } from 'react';
import { SOORT_LABEL, type Soort } from '@/lib/types';

/**
 * Kiezen welke soorten je op de kaart wilt zien, en tegelijk de legenda: bij
 * elke regel staat de vorm waarop je die soort herkent.
 *
 * Staat in de bovenbalk en niet als vlak over de kaart, want daar dekte het
 * blokken af die juist in beeld moesten blijven.
 */

export const VORM_KLEIN: Record<Soort, string> = {
  persoon: 'rounded-full',
  eenmanszaak: 'rounded-l-full rounded-r-[3px]',
  holding: 'rounded-[3px] dubbele-rand-klein',
  werkmaatschappij: 'rounded-[3px]',
};

const SOORTEN: Soort[] = ['persoon', 'eenmanszaak', 'holding', 'werkmaatschappij'];

export default function SoortMenu({
  verborgen,
  opWisselen,
  opAllesTonen,
  aantalZichtbaar,
  aantalTotaal,
}: {
  verborgen: ReadonlySet<Soort>;
  opWisselen: (soort: Soort) => void;
  opAllesTonen: () => void;
  aantalZichtbaar: number;
  aantalTotaal: number;
}) {
  const [open, setOpen] = useState(false);
  const omhulsel = useRef<HTMLDivElement>(null);
  const erIsIetsUit = verborgen.size > 0;

  useEffect(() => {
    function opKlik(e: MouseEvent) {
      if (!omhulsel.current?.contains(e.target as Node)) setOpen(false);
    }
    function opToets(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', opKlik);
    document.addEventListener('keydown', opToets);
    return () => {
      document.removeEventListener('mousedown', opKlik);
      document.removeEventListener('keydown', opToets);
    };
  }, []);

  return (
    <div ref={omhulsel} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={[
          'flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors',
          erIsIetsUit
            ? 'border-groen-700 bg-groen-50 text-groen-800'
            : 'border-rand text-inkt-zacht hover:text-inkt hover:bg-groen-50',
        ].join(' ')}
      >
        Tonen
        {erIsIetsUit && (
          <span className="bg-groen-700 rounded px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {aantalZichtbaar}
          </span>
        )}
      </button>

      {open && (
        <div className="border-rand bg-paneel absolute top-full right-0 z-40 mt-1 w-60 rounded-md border p-1.5 shadow-lg">
          <ul>
            {SOORTEN.map((soort) => {
              const uit = verborgen.has(soort);
              return (
                <li key={soort}>
                  <button
                    type="button"
                    onClick={() => opWisselen(soort)}
                    aria-pressed={!uit}
                    className="hover:bg-groen-50 flex min-h-11 w-full items-center gap-3 rounded px-2 text-left transition-colors"
                  >
                    <span
                      className={[
                        'h-3.5 w-7 shrink-0',
                        uit ? 'bg-rand-sterk' : 'bg-groen-700',
                        VORM_KLEIN[soort],
                      ].join(' ')}
                    />
                    <span
                      className={[
                        'flex-1 truncate text-sm',
                        uit ? 'text-inkt-zacht line-through' : '',
                      ].join(' ')}
                    >
                      {SOORT_LABEL[soort]}
                    </span>
                    <span className="text-inkt-zacht text-xs">
                      {uit ? 'uit' : 'aan'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-rand mt-1.5 flex items-center justify-between gap-2 border-t px-2 pt-2">
            <span className="text-inkt-zacht text-xs">
              {aantalZichtbaar} van {aantalTotaal} in beeld
            </span>
            {erIsIetsUit && (
              <button
                type="button"
                onClick={opAllesTonen}
                className="text-groen-700 text-xs underline underline-offset-2"
              >
                Alles tonen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
