'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import {
  SOORT_LABEL,
  STATUS_LABEL,
  UITVOERING_LABEL,
  type Contactpersoon,
  type Document,
  type Entiteit,
  type ProcesMetStappen,
  type Taak,
  type Taakstatus,
} from '@/lib/types';

export type Tabblad =
  | 'overzicht'
  | 'processen'
  | 'taken'
  | 'documenten'
  | 'contactpersonen';

const TABBLADEN: Array<{ sleutel: Tabblad; label: string }> = [
  { sleutel: 'overzicht', label: 'Overzicht' },
  { sleutel: 'processen', label: 'Processen' },
  { sleutel: 'taken', label: 'Taken' },
  { sleutel: 'documenten', label: 'Documenten' },
  { sleutel: 'contactpersonen', label: 'Contactpersonen' },
];

const STATUS_KLEUR: Record<Taakstatus, string> = {
  open: 'bg-slate-100 text-slate-700',
  bezig: 'bg-amber-100 text-amber-800',
  gereed: 'bg-groen-100 text-groen-800',
  geblokkeerd: 'bg-red-100 text-red-800',
};

type Inhoud = {
  processen: ProcesMetStappen[];
  taken: Taak[];
  documenten: Document[];
  contactpersonen: Contactpersoon[];
};

const LEEG: Inhoud = { processen: [], taken: [], documenten: [], contactpersonen: [] };

export default function Zijpaneel({
  entiteit,
  eigenaren,
  bezittingen,
  tabblad,
  opTabblad,
  opSluiten,
}: {
  entiteit: Entiteit;
  /** Namen van de onderdelen die deze entiteit bezitten, voor zover zichtbaar. */
  eigenaren: string[];
  /** Namen van de onderdelen die deze entiteit bezit, voor zover zichtbaar. */
  bezittingen: string[];
  tabblad: Tabblad;
  opTabblad: (t: Tabblad) => void;
  opSluiten: () => void;
}) {
  // De uitkomst wordt bewaard met het id waar die bij hoort. Zolang dat id niet
  // overeenkomt met het geopende onderdeel, geldt het paneel als "bezig". Zo
  // hoeft de staat niet synchroon in het effect gewist te worden.
  const [uitkomst, setUitkomst] = useState<{
    id: string;
    inhoud: Inhoud;
    fout: string | null;
  }>({ id: '', inhoud: LEEG, fout: null });

  const actueel = uitkomst.id === entiteit.id;
  const bezig = !actueel;
  const inhoud = actueel ? uitkomst.inhoud : LEEG;
  const fout = actueel ? uitkomst.fout : null;

  useEffect(() => {
    let afgebroken = false;
    const db = supabaseBrowser();
    const id = entiteit.id;

    // Alles gaat via de sessie van de gebruiker, dus door Row Level Security.
    Promise.all([
      db
        .from('kaart_processen')
        .select('*, stappen:kaart_processtappen(*)')
        .eq('entiteit_id', entiteit.id)
        .order('volgorde')
        .order('volgorde', { referencedTable: 'kaart_processtappen' }),
      db
        .from('kaart_taken')
        .select('*')
        .eq('entiteit_id', entiteit.id)
        .order('deadline', { nullsFirst: false })
        .order('titel'),
      db
        .from('kaart_documenten')
        .select('*')
        .eq('entiteit_id', entiteit.id)
        .order('titel'),
      db
        .from('kaart_contactpersonen')
        .select('*')
        .eq('entiteit_id', entiteit.id)
        .order('naam'),
    ])
      .then(([p, t, d, c]) => {
        if (afgebroken) return;
        const eersteFout = p.error ?? t.error ?? d.error ?? c.error;
        setUitkomst({
          id,
          fout: eersteFout ? eersteFout.message : null,
          inhoud: eersteFout
            ? LEEG
            : {
                processen: (p.data ?? []) as unknown as ProcesMetStappen[],
                taken: (t.data ?? []) as Taak[],
                documenten: (d.data ?? []) as Document[],
                contactpersonen: (c.data ?? []) as Contactpersoon[],
              },
        });
      })
      .catch((e: unknown) => {
        if (afgebroken) return;
        setUitkomst({
          id,
          inhoud: LEEG,
          fout: e instanceof Error ? e.message : 'Ophalen mislukt.',
        });
      });

    return () => {
      afgebroken = true;
    };
  }, [entiteit.id]);

  const aantal: Record<Tabblad, number | null> = {
    overzicht: null,
    processen: inhoud.processen.length,
    taken: inhoud.taken.length,
    documenten: inhoud.documenten.length,
    contactpersonen: inhoud.contactpersonen.length,
  };

  // Tot 1280 px schuift het paneel als vol overlay over de kaart, daarboven
  // staat het als eigen kolom ernaast. Bij 500 px passen alle vijf de
  // tabbladen naast elkaar; smaller zou de rij moeten schuiven.
  return (
    <aside
      className="border-rand bg-paneel absolute inset-0 z-30 flex flex-col overflow-hidden border-l xl:static xl:inset-auto xl:w-[500px] xl:shrink-0"
      aria-label={`Gegevens van ${entiteit.naam}`}
    >
      <div className="border-rand flex items-start gap-3 border-b px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="text-inkt-zacht text-[11px] font-medium tracking-wide uppercase">
            {SOORT_LABEL[entiteit.soort]}
          </div>
          <h2 className="mt-0.5 text-lg leading-tight font-semibold tracking-tight">
            {entiteit.naam}
          </h2>
        </div>
        <button
          type="button"
          onClick={opSluiten}
          aria-label="Paneel sluiten"
          className="text-inkt-zacht hover:bg-groen-50 hover:text-groen-800 -mt-1 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-xl transition-colors"
        >
          &times;
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Onderdelen van dit blok"
        className="border-rand flex shrink-0 overflow-x-auto border-b px-2"
      >
        {TABBLADEN.map(({ sleutel, label }) => {
          const actief = sleutel === tabblad;
          return (
            <button
              key={sleutel}
              role="tab"
              aria-selected={actief}
              onClick={() => opTabblad(sleutel)}
              className={[
                'relative min-h-11 shrink-0 px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors',
                actief
                  ? 'text-groen-800 after:bg-groen-700 after:absolute after:inset-x-1.5 after:-bottom-px after:h-0.5'
                  : 'text-inkt-zacht hover:text-inkt',
              ].join(' ')}
            >
              {label}
              {aantal[sleutel] !== null && aantal[sleutel]! > 0 && (
                <span className="text-inkt-zacht ml-1.5 text-xs">{aantal[sleutel]}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {fout && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            Ophalen mislukt: {fout}
          </p>
        )}

        {tabblad === 'overzicht' && (
          <Overzicht
            entiteit={entiteit}
            eigenaren={eigenaren}
            bezittingen={bezittingen}
          />
        )}

        {tabblad !== 'overzicht' && bezig && <Bezig />}

        {tabblad === 'processen' && !bezig && (
          <Processen processen={inhoud.processen} />
        )}
        {tabblad === 'taken' && !bezig && <Taken taken={inhoud.taken} />}
        {tabblad === 'documenten' && !bezig && (
          <Documenten documenten={inhoud.documenten} />
        )}
        {tabblad === 'contactpersonen' && !bezig && (
          <Contactpersonen personen={inhoud.contactpersonen} />
        )}
      </div>
    </aside>
  );
}

function Bezig() {
  return <p className="text-inkt-zacht text-sm">Bezig met ophalen...</p>;
}

function Leeg({ tekst }: { tekst: string }) {
  return (
    <p className="border-rand text-inkt-zacht rounded-md border border-dashed px-4 py-6 text-center text-sm">
      {tekst}
    </p>
  );
}

function Overzicht({
  entiteit,
  eigenaren,
  bezittingen,
}: {
  entiteit: Entiteit;
  eigenaren: string[];
  bezittingen: string[];
}) {
  return (
    <div className="space-y-5">
      {entiteit.korte_omschrijving && (
        <p className="text-[15px] leading-relaxed">{entiteit.korte_omschrijving}</p>
      )}

      {entiteit.uitgebreide_omschrijving ? (
        <div className="space-y-2">
          <h3 className="text-inkt-zacht text-[11px] font-semibold tracking-wide uppercase">
            Toelichting
          </h3>
          <p className="text-inkt-zacht text-sm leading-relaxed whitespace-pre-line">
            {entiteit.uitgebreide_omschrijving}
          </p>
        </div>
      ) : (
        <Leeg tekst="Nog geen uitgebreide omschrijving. Een beheerder kan die toevoegen." />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Lijstje titel="Eigendom van" namen={eigenaren} leeg="Geen eigenaren zichtbaar." />
        <Lijstje titel="Eigenaar van" namen={bezittingen} leeg="Geen deelnemingen zichtbaar." />
      </div>
    </div>
  );
}

function Lijstje({
  titel,
  namen,
  leeg,
}: {
  titel: string;
  namen: string[];
  leeg: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-inkt-zacht text-[11px] font-semibold tracking-wide uppercase">
        {titel}
      </h3>
      {namen.length === 0 ? (
        <p className="text-inkt-zacht text-sm">{leeg}</p>
      ) : (
        <ul className="space-y-1">
          {namen.map((n) => (
            <li key={n} className="text-sm">
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Processen({ processen }: { processen: ProcesMetStappen[] }) {
  if (processen.length === 0) {
    return <Leeg tekst="Nog geen processen vastgelegd voor dit onderdeel." />;
  }

  return (
    <div className="space-y-6">
      {processen.map((proces) => (
        <article key={proces.id} className="space-y-3">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight">{proces.titel}</h3>
            {proces.beschrijving && (
              <p className="text-inkt-zacht mt-1 text-sm leading-relaxed">
                {proces.beschrijving}
              </p>
            )}
          </div>

          {proces.stappen.length === 0 ? (
            <p className="text-inkt-zacht text-sm">Nog geen stappen.</p>
          ) : (
            <ol className="space-y-2">
              {proces.stappen.map((stap, i) => (
                <li
                  key={stap.id}
                  className="border-rand bg-groen-50/40 rounded-md border px-3 py-2.5"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="bg-groen-700 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{stap.titel}</span>
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
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </article>
      ))}
    </div>
  );
}

function Taken({ taken }: { taken: Taak[] }) {
  if (taken.length === 0) {
    return <Leeg tekst="Nog geen taken vastgelegd voor dit onderdeel." />;
  }

  return (
    <ul className="divide-rand divide-y">
      {taken.map((taak) => (
        <li key={taak.id} className="flex items-start gap-3 py-3 first:pt-0">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{taak.titel}</div>
            <div className="text-inkt-zacht mt-0.5 text-xs">
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

function Documenten({ documenten }: { documenten: Document[] }) {
  if (documenten.length === 0) {
    return <Leeg tekst="Nog geen documenten gekoppeld aan dit onderdeel." />;
  }

  return (
    <ul className="divide-rand divide-y">
      {documenten.map((doc) => (
        <li key={doc.id} className="py-1 first:pt-0">
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:bg-groen-50 -mx-2 flex min-h-11 items-center gap-2 rounded px-2 transition-colors"
          >
            <span className="text-groen-700 min-w-0 flex-1 truncate text-sm font-medium underline underline-offset-2">
              {doc.titel}
            </span>
            <span className="text-inkt-zacht shrink-0 text-xs">openen</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function Contactpersonen({ personen }: { personen: Contactpersoon[] }) {
  if (personen.length === 0) {
    return <Leeg tekst="Nog geen contactpersonen vastgelegd voor dit onderdeel." />;
  }

  return (
    <ul className="divide-rand divide-y">
      {personen.map((p) => (
        <li key={p.id} className="space-y-0.5 py-3 first:pt-0">
          <div className="text-sm font-medium">{p.naam}</div>
          {p.rol && <div className="text-inkt-zacht text-xs">{p.rol}</div>}
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
            {p.email && (
              <a
                href={`mailto:${p.email}`}
                className="text-groen-700 underline underline-offset-2"
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
