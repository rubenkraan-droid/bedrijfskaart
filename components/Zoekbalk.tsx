'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { SOORT_LABEL, type Entiteit } from '@/lib/types';

export type Treffer = {
  entiteitId: string;
  titel: string;
  bijschrift: string;
  /** Welk vak op de onderdeelpagina meteen open moet. */
  vak: 'overzicht' | 'processen';
};

/**
 * Zoekt tegelijk in de onderdelen en in de processen.
 *
 * De onderdelen staan al in het geheugen, want de server heeft die onder Row
 * Level Security opgehaald: alles wat hier doorzoekbaar is, mag deze gebruiker
 * ook zien. Processen worden opgevraagd bij de database, opnieuw onder Row Level
 * Security, dus ook daar komt niets terug van een onderdeel zonder toegang.
 */
export default function Zoekbalk({
  entiteiten,
  opKiezen,
}: {
  entiteiten: Entiteit[];
  opKiezen: (treffer: Treffer) => void;
}) {
  const [term, setTerm] = useState('');
  // De uitkomst wordt bewaard met de zoekterm waar die bij hoort, zodat oude
  // resultaten niet bij een nieuwe term blijven staan en de staat niet
  // synchroon in het effect gewist hoeft te worden.
  const [procesUitkomst, setProcesUitkomst] = useState<{
    term: string;
    treffers: Treffer[];
  }>({ term: '', treffers: [] });
  const [open, setOpen] = useState(false);
  const omhulsel = useRef<HTMLDivElement>(null);
  const lijstId = useId();

  const schoon = term.trim();

  // Processen opvragen, met een korte vertraging zodat niet elke toetsaanslag
  // een verzoek wordt.
  useEffect(() => {
    if (schoon.length < 2) return;

    let afgebroken = false;
    const timer = setTimeout(async () => {
      const patroon = `%${schoon.replace(/[%_]/g, (t) => `\\${t}`)}%`;
      const { data } = await supabaseBrowser()
        .from('kaart_processen')
        .select('id, titel, entiteit_id')
        .or(`titel.ilike.${patroon},beschrijving.ilike.${patroon}`)
        .limit(8);

      if (afgebroken) return;

      const naamVan = new Map(entiteiten.map((e) => [e.id, e.naam]));
      const rijen = (data ?? []) as Array<{
        id: string;
        titel: string;
        entiteit_id: string;
      }>;
      setProcesUitkomst({
        term: schoon,
        treffers: rijen.map((p) => ({
          entiteitId: p.entiteit_id,
          titel: p.titel,
          bijschrift: `Hoofdtaak bij ${naamVan.get(p.entiteit_id) ?? 'onbekend onderdeel'}`,
          vak: 'processen' as const,
        })),
      });
    }, 200);

    return () => {
      afgebroken = true;
      clearTimeout(timer);
    };
  }, [schoon, entiteiten]);

  // Buiten klikken sluit de lijst.
  useEffect(() => {
    function opKlik(e: MouseEvent) {
      if (!omhulsel.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', opKlik);
    return () => document.removeEventListener('mousedown', opKlik);
  }, []);

  const onderdeelTreffers: Treffer[] =
    schoon.length === 0
      ? []
      : entiteiten
          .filter((e) => {
            const naald = schoon.toLowerCase();
            return (
              e.naam.toLowerCase().includes(naald) ||
              (e.korte_omschrijving ?? '').toLowerCase().includes(naald)
            );
          })
          .slice(0, 8)
          .map((e) => ({
            entiteitId: e.id,
            titel: e.naam,
            bijschrift: SOORT_LABEL[e.soort],
            vak: 'overzicht' as const,
          }));

  // Alleen de uitkomst die bij de huidige zoekterm hoort.
  const procesTreffers =
    procesUitkomst.term === schoon ? procesUitkomst.treffers : [];

  const treffers = [...onderdeelTreffers, ...procesTreffers];
  const toon = open && schoon.length > 0;

  function kies(treffer: Treffer) {
    opKiezen(treffer);
    setTerm('');
    setOpen(false);
  }

  return (
    <div ref={omhulsel} className="relative w-full sm:max-w-md">
      <input
        type="search"
        role="combobox"
        aria-expanded={toon}
        aria-controls={lijstId}
        aria-label="Zoek een onderdeel of hoofdtaak"
        placeholder="Zoek een onderdeel of hoofdtaak"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && treffers.length > 0) {
            e.preventDefault();
            kies(treffers[0]);
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        className="border-rand focus:border-groen-700 min-h-11 w-full rounded-md border bg-white px-3 text-sm outline-none"
      />

      {toon && (
        <ul
          id={lijstId}
          role="listbox"
          className="border-rand bg-paneel absolute top-full right-0 left-0 z-40 mt-1 max-h-80 overflow-y-auto rounded-md border shadow-lg"
        >
          {treffers.length === 0 ? (
            <li className="text-inkt-zacht px-3 py-3 text-sm">
              Niets gevonden voor &ldquo;{schoon}&rdquo;.
            </li>
          ) : (
            treffers.map((t) => (
              <li key={`${t.vak}-${t.entiteitId}-${t.titel}`} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => kies(t)}
                  className="hover:bg-groen-50 flex min-h-11 w-full flex-col items-start justify-center px-3 py-2 text-left transition-colors"
                >
                  <span className="text-sm font-medium">{t.titel}</span>
                  <span className="text-inkt-zacht text-xs">{t.bijschrift}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
