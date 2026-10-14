'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import Kop from '@/components/Kop';
import {
  Contactpersonen,
  Documenten,
  Leeg,
  Processen,
  Taken,
} from '@/components/Inhoud';
import { useGebruiker } from '@/lib/auth';
import { ofFout, useGegevens } from '@/lib/gegevens';
import { supabaseBrowser } from '@/lib/supabase/client';
import {
  SOORT_LABEL,
  type Contactpersoon,
  type Document,
  type Entiteit,
  type ProcesMetStappen,
  type Relatie,
  type Taak,
} from '@/lib/types';

type Vak = 'overzicht' | 'processen' | 'taken' | 'documenten' | 'contactpersonen';

const VAKKEN: Array<{ sleutel: Vak; label: string }> = [
  { sleutel: 'overzicht', label: 'Overzicht' },
  { sleutel: 'processen', label: 'Processen' },
  { sleutel: 'taken', label: 'Taken' },
  { sleutel: 'documenten', label: 'Documenten' },
  { sleutel: 'contactpersonen', label: 'Contactpersonen' },
];

export default function OnderdeelPagina() {
  return (
    <Suspense fallback={null}>
      <Onderdeel />
    </Suspense>
  );
}

function Onderdeel() {
  const ik = useGebruiker();
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const startVak = (params.get('vak') as Vak | null) ?? 'overzicht';
  const [vak, setVak] = useState<Vak>(startVak);

  const { data, bezig, fout } = useGegevens(`ruimte-${id}`, async () => {
    if (!id) return null;
    const db = supabaseBrowser();
    const [entiteit, buren, relaties, processen, taken, documenten, contacten] =
      await Promise.all([
        db.from('kaart_entiteiten').select('*').eq('id', id).maybeSingle(),
        ofFout<Array<{ id: string; naam: string }>>(
          db.from('kaart_entiteiten').select('id, naam')
        ),
        ofFout<Relatie[]>(
          db
            .from('kaart_relaties')
            .select('*')
            .or(`van_entiteit.eq.${id},naar_entiteit.eq.${id}`)
        ),
        ofFout<ProcesMetStappen[]>(
          db
            .from('kaart_processen')
            .select('*, stappen:kaart_processtappen(*)')
            .eq('entiteit_id', id)
            .order('volgorde')
            .order('volgorde', { referencedTable: 'kaart_processtappen' })
        ),
        ofFout<Taak[]>(
          db
            .from('kaart_taken')
            .select('*')
            .eq('entiteit_id', id)
            .order('deadline', { nullsFirst: false })
            .order('titel')
        ),
        ofFout<Document[]>(
          db.from('kaart_documenten').select('*').eq('entiteit_id', id).order('titel')
        ),
        ofFout<Contactpersoon[]>(
          db.from('kaart_contactpersonen').select('*').eq('entiteit_id', id).order('naam')
        ),
      ]);

    if (entiteit.error) throw new Error(entiteit.error.message);
    return {
      entiteit: entiteit.data as Entiteit | null,
      buren,
      relaties,
      processen,
      taken,
      documenten,
      contacten,
    };
  });

  if (!ik) return null;

  if (bezig || !data) {
    return (
      <Frame ik={ik}>
        <div className="flex flex-1 items-center justify-center py-20">
          <p className="text-inkt-zacht text-sm">Bezig met laden...</p>
        </div>
      </Frame>
    );
  }

  if (fout || !data.entiteit) {
    return (
      <Frame ik={ik}>
        <div className="mx-auto max-w-md px-6 py-20 text-center">
          <h1 className="text-lg font-semibold tracking-tight">
            Dit onderdeel is niet te openen
          </h1>
          <p className="text-inkt-zacht mt-2 text-sm leading-relaxed">
            {fout ?? 'Het bestaat niet, of je hebt er geen toegang toe.'}
          </p>
          <Link
            href="/"
            className="text-groen-700 mt-4 inline-block text-sm underline underline-offset-4"
          >
            Terug naar de kaart
          </Link>
        </div>
      </Frame>
    );
  }

  const { entiteit, buren, relaties, processen, taken, documenten, contacten } = data;
  const naamVan = new Map(buren.map((e) => [e.id, e.naam]));

  const eigenaren = relaties
    .filter((r) => r.naar_entiteit === id)
    .map((r) => ({ id: r.van_entiteit, naam: naamVan.get(r.van_entiteit) }))
    .filter((e): e is { id: string; naam: string } => Boolean(e.naam))
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));

  const bezittingen = relaties
    .filter((r) => r.van_entiteit === id)
    .map((r) => ({ id: r.naar_entiteit, naam: naamVan.get(r.naar_entiteit) }))
    .filter((e): e is { id: string; naam: string } => Boolean(e.naam))
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));

  const aantal: Record<Vak, number | null> = {
    overzicht: null,
    processen: processen.length,
    taken: taken.length,
    documenten: documenten.length,
    contactpersonen: contacten.length,
  };

  return (
    <Frame ik={ik}>
      <div className="kamer-binnen flex min-h-0 flex-1 flex-col">
        {/* De gevel: hetzelfde donkergroen als het blok op de kaart, zodat het
            voelt alsof je dat blok bent binnengegaan. */}
        <div className="bg-groen-700 text-white">
          <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6 sm:py-8">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
            >
              <span aria-hidden>&larr;</span> Terug naar de kaart
            </Link>

            <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold tracking-wider text-white/60 uppercase">
                  {SOORT_LABEL[entiteit.soort]}
                </div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {entiteit.naam}
                </h1>
              </div>

              {ik.isBeheerder && (
                <Link
                  href={{ pathname: '/beheer/onderdeel', query: { id } }}
                  className="flex min-h-11 shrink-0 items-center rounded-md bg-white/10 px-3.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
                >
                  Bewerken
                </Link>
              )}
            </div>

            {entiteit.korte_omschrijving && (
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/80">
                {entiteit.korte_omschrijving}
              </p>
            )}
          </div>
        </div>

        {/* De deuren naar de kamers binnen dit onderdeel. */}
        <div className="border-rand bg-paneel sticky top-0 z-10 border-b">
          <div
            role="tablist"
            aria-label="Onderdelen van dit blok"
            className="mx-auto flex w-full max-w-3xl gap-1 overflow-x-auto px-3 sm:px-4"
          >
            {VAKKEN.map(({ sleutel, label }) => {
              const actief = sleutel === vak;
              return (
                <button
                  key={sleutel}
                  role="tab"
                  aria-selected={actief}
                  onClick={() => setVak(sleutel)}
                  className={[
                    'relative min-h-12 shrink-0 px-3 text-sm font-medium whitespace-nowrap transition-colors',
                    actief
                      ? 'text-groen-800 after:bg-groen-700 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5'
                      : 'text-inkt-zacht hover:text-inkt',
                  ].join(' ')}
                >
                  {label}
                  {aantal[sleutel] !== null && aantal[sleutel]! > 0 && (
                    <span className="text-inkt-zacht ml-1.5 text-xs">
                      {aantal[sleutel]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-5 py-7 sm:px-6">
            {vak === 'overzicht' && (
              <Overzicht
                entiteit={entiteit}
                eigenaren={eigenaren}
                bezittingen={bezittingen}
              />
            )}
            {vak === 'processen' && <Processen processen={processen} />}
            {vak === 'taken' && <Taken taken={taken} />}
            {vak === 'documenten' && <Documenten documenten={documenten} />}
            {vak === 'contactpersonen' && <Contactpersonen personen={contacten} />}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function Frame({
  ik,
  children,
}: {
  ik: { naam: string | null; email: string; isBeheerder: boolean };
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Kop naam={ik.naam} email={ik.email} isBeheerder={ik.isBeheerder} />
      {children}
    </div>
  );
}

function Overzicht({
  entiteit,
  eigenaren,
  bezittingen,
}: {
  entiteit: Entiteit;
  eigenaren: Array<{ id: string; naam: string }>;
  bezittingen: Array<{ id: string; naam: string }>;
}) {
  return (
    <div className="space-y-8">
      {entiteit.uitgebreide_omschrijving ? (
        <p className="text-[15px] leading-relaxed whitespace-pre-line">
          {entiteit.uitgebreide_omschrijving}
        </p>
      ) : (
        <Leeg tekst="Nog geen uitgebreide omschrijving. Een beheerder kan die toevoegen." />
      )}

      <div className="grid gap-7 sm:grid-cols-2">
        <Buren
          titel="Eigendom van"
          buren={eigenaren}
          leeg="Geen eigenaren zichtbaar."
        />
        <Buren
          titel="Eigenaar van"
          buren={bezittingen}
          leeg="Geen deelnemingen zichtbaar."
        />
      </div>
    </div>
  );
}

/** De deuren naar de buren: klik en je loopt dat kantoor binnen. */
function Buren({
  titel,
  buren,
  leeg,
}: {
  titel: string;
  buren: Array<{ id: string; naam: string }>;
  leeg: string;
}) {
  const router = useRouter();

  return (
    <div>
      <h3 className="text-inkt-zacht text-[11px] font-semibold tracking-wide uppercase">
        {titel}
      </h3>
      {buren.length === 0 ? (
        <p className="text-inkt-zacht mt-2 text-sm">{leeg}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {buren.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => {
                  router.push(`/onderdeel/?id=${b.id}`);
                }}
                className="border-rand hover:border-groen-700 hover:bg-groen-50 flex min-h-11 items-center rounded-full border px-3.5 text-sm font-medium transition-colors"
              >
                {b.naam}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
