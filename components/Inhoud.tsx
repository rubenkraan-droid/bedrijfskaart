'use client';

import {
  STATUS_LABEL,
  UITVOERING_LABEL,
  type Contactpersoon,
  type Document,
  type ProcesMetStappen,
  type Taak,
  type Taakstatus,
} from '@/lib/types';

/**
 * De inhoud van een onderdeel: processen, taken, documenten en contactpersonen.
 * Staat apart zodat de onderdeelpagina en eventuele andere schermen hem kunnen
 * gebruiken.
 */

const STATUS_KLEUR: Record<Taakstatus, string> = {
  open: 'bg-slate-100 text-slate-700',
  bezig: 'bg-amber-100 text-amber-800',
  gereed: 'bg-groen-100 text-groen-800',
  geblokkeerd: 'bg-red-100 text-red-800',
};

export function Leeg({ tekst }: { tekst: string }) {
  return (
    <p className="border-rand text-inkt-zacht rounded-lg border border-dashed px-5 py-10 text-center text-sm">
      {tekst}
    </p>
  );
}

export function Processen({ processen }: { processen: ProcesMetStappen[] }) {
  if (processen.length === 0) {
    return <Leeg tekst="Nog geen processen vastgelegd voor dit onderdeel." />;
  }

  return (
    <div className="space-y-8">
      {processen.map((proces) => (
        <article key={proces.id}>
          <h3 className="text-lg font-semibold tracking-tight">{proces.titel}</h3>
          {proces.beschrijving && (
            <p className="text-inkt-zacht mt-1 text-[15px] leading-relaxed">
              {proces.beschrijving}
            </p>
          )}

          {proces.stappen.length === 0 ? (
            <p className="text-inkt-zacht mt-3 text-sm">Nog geen stappen.</p>
          ) : (
            <ol className="border-rand mt-4 space-y-0 border-l-2 pl-0">
              {proces.stappen.map((stap, i) => (
                <li key={stap.id} className="relative pb-5 pl-6 last:pb-0">
                  <span className="bg-groen-700 absolute top-0.5 -left-[11px] flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-medium">{stap.titel}</span>
                    <span
                      className={[
                        'rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
                        stap.uitvoering === 'automatisch'
                          ? 'bg-groen-100 text-groen-800'
                          : 'bg-slate-100 text-slate-700',
                      ].join(' ')}
                    >
                      {UITVOERING_LABEL[stap.uitvoering]}
                    </span>
                  </div>
                  {stap.beschrijving && (
                    <p className="text-inkt-zacht mt-1 text-sm leading-relaxed">
                      {stap.beschrijving}
                    </p>
                  )}
                  {stap.toelichting && (
                    <p className="text-inkt-zacht mt-1 text-xs">
                      {stap.uitvoering === 'automatisch' ? 'Koppeling: ' : 'Door: '}
                      {stap.toelichting}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </article>
      ))}
    </div>
  );
}

export function Taken({ taken }: { taken: Taak[] }) {
  if (taken.length === 0) {
    return <Leeg tekst="Nog geen taken vastgelegd voor dit onderdeel." />;
  }

  return (
    <ul className="divide-rand divide-y">
      {taken.map((taak) => (
        <li key={taak.id} className="flex items-start gap-4 py-3.5 first:pt-0">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium">{taak.titel}</div>
            <div className="text-inkt-zacht mt-0.5 text-sm">
              {taak.verantwoordelijke ?? 'Geen verantwoordelijke'}
              {taak.deadline && ` · uiterlijk ${datum(taak.deadline)}`}
            </div>
          </div>
          <span
            className={[
              'shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold',
              STATUS_KLEUR[taak.status],
            ].join(' ')}
          >
            {STATUS_LABEL[taak.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Documenten({ documenten }: { documenten: Document[] }) {
  if (documenten.length === 0) {
    return <Leeg tekst="Nog geen documenten gekoppeld aan dit onderdeel." />;
  }

  return (
    <ul className="divide-rand divide-y">
      {documenten.map((doc) => (
        <li key={doc.id}>
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:bg-groen-50 -mx-3 flex min-h-14 items-center gap-3 rounded-md px-3 transition-colors"
          >
            <span className="text-groen-700 min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium underline underline-offset-2">
                {doc.titel}
              </span>
              <span className="text-inkt-zacht block truncate text-xs">{doc.url}</span>
            </span>
            <span className="text-inkt-zacht shrink-0 text-xs">openen</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function Contactpersonen({ personen }: { personen: Contactpersoon[] }) {
  if (personen.length === 0) {
    return <Leeg tekst="Nog geen contactpersonen vastgelegd voor dit onderdeel." />;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {personen.map((p) => (
        <li key={p.id} className="border-rand rounded-lg border px-4 py-3.5">
          <div className="text-[15px] font-medium">{p.naam}</div>
          {p.rol && <div className="text-inkt-zacht text-sm">{p.rol}</div>}
          <div className="mt-1.5 flex flex-col gap-0.5 text-sm">
            {p.email && (
              <a
                href={`mailto:${p.email}`}
                className="text-groen-700 truncate underline underline-offset-2"
              >
                {p.email}
              </a>
            )}
            {p.telefoon && (
              <a
                href={`tel:${p.telefoon.replace(/\s/g, '')}`}
                className="text-groen-700 underline underline-offset-2"
              >
                {p.telefoon}
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function datum(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
