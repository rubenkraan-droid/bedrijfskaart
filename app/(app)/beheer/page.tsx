'use client';

import Link from 'next/link';
import Formulier, { VerwijderKnop } from '@/components/beheer/Formulier';
import { Keuze, Leeg, Sectie, Tekstvak, Veld } from '@/components/beheer/velden';
import {
  maakOnderdeel,
  maakRelatie,
  verwijderOnderdeel,
  verwijderRelatie,
} from '@/lib/acties';
import { ofFout, useGegevens } from '@/lib/gegevens';
import { supabaseBrowser } from '@/lib/supabase/client';
import { SOORT_LABEL, type Entiteit, type Relatie } from '@/lib/types';

const SOORT_OPTIES = [
  { waarde: 'persoon', label: 'Persoon' },
  { waarde: 'eenmanszaak', label: 'Eenmanszaak' },
  { waarde: 'holding', label: 'Holding' },
  { waarde: 'werkmaatschappij', label: 'Werkmaatschappij' },
];

export default function BeheerOnderdelen() {
  const { data, bezig, fout, herlaad } = useGegevens('beheer-onderdelen', async () => {
    const db = supabaseBrowser();
    const [entiteiten, relaties] = await Promise.all([
      ofFout<Entiteit[]>(
        db.from('kaart_entiteiten').select('*').order('soort').order('naam')
      ),
      ofFout<Relatie[]>(db.from('kaart_relaties').select('*')),
    ]);
    return { entiteiten, relaties };
  });

  if (fout) return <Leeg tekst={`Ophalen mislukt: ${fout}`} />;
  if (bezig || !data) return <Leeg tekst="Bezig met laden..." />;

  const { entiteiten, relaties } = data;
  const naamVan = new Map(entiteiten.map((e) => [e.id, e.naam]));
  const opties = entiteiten.map((e) => ({ waarde: e.id, label: e.naam }));

  const gesorteerdeRelaties = [...relaties].sort((a, b) =>
    `${naamVan.get(a.van_entiteit)}${naamVan.get(a.naar_entiteit)}`.localeCompare(
      `${naamVan.get(b.van_entiteit)}${naamVan.get(b.naar_entiteit)}`,
      'nl'
    )
  );

  return (
    <div className="space-y-6">
      <Sectie
        titel="Onderdelen"
        toelichting={`${entiteiten.length} onderdelen. Klik op een naam om de inhoud te beheren.`}
      >
        {entiteiten.length === 0 ? (
          <Leeg tekst="Nog geen onderdelen. Voeg er hieronder een toe." />
        ) : (
          <ul className="divide-rand divide-y">
            {entiteiten.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-1.5">
                <Link
                  href={{ pathname: '/beheer/onderdeel', query: { id: e.id } }}
                  className="hover:bg-groen-50 -mx-2 flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded px-2 transition-colors"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {e.naam}
                  </span>
                  <span className="text-inkt-zacht shrink-0 text-xs">
                    {SOORT_LABEL[e.soort]}
                  </span>
                </Link>
                <VerwijderKnop
                  actie={verwijderOnderdeel}
                  velden={{ id: e.id }}
                  bevestiging={`"${e.naam}" verwijderen? Ook de processen, taken, documenten, contactpersonen, relaties en toegangsrechten van dit onderdeel verdwijnen.`}
                  naAfloop={herlaad}
                />
              </li>
            ))}
          </ul>
        )}
      </Sectie>

      <Sectie
        titel="Onderdeel toevoegen"
        toelichting="Het nieuwe blok komt op de opgegeven positie te staan; die kun je daarna op de kaart verslepen."
      >
        <Formulier actie={maakOnderdeel} knop="Onderdeel toevoegen" naAfloop={herlaad}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Veld naam="naam" label="Naam" verplicht plaatshouder="Nieuwe B.V." />
            <Keuze naam="soort" label="Soort" opties={SOORT_OPTIES} verplicht />
          </div>
          <Tekstvak
            naam="korte_omschrijving"
            label="Korte omschrijving"
            regels={2}
            plaatshouder="Een regel die bovenaan het zijpaneel komt te staan."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Veld naam="positie_x" label="Positie x" type="number" waarde={0} />
            <Veld naam="positie_y" label="Positie y" type="number" waarde={800} />
          </div>
        </Formulier>
      </Sectie>

      <Sectie
        titel="Eigendomsrelaties"
        toelichting={`${relaties.length} relaties, gericht van eigenaar naar onderdeel. Zonder percentages.`}
      >
        <div className="space-y-5">
          {gesorteerdeRelaties.length === 0 ? (
            <Leeg tekst="Nog geen relaties." />
          ) : (
            <ul className="divide-rand divide-y">
              {gesorteerdeRelaties.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-1.5">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{naamVan.get(r.van_entiteit)}</span>
                    <span className="text-inkt-zacht"> is eigenaar van </span>
                    <span className="font-medium">{naamVan.get(r.naar_entiteit)}</span>
                  </span>
                  <VerwijderKnop
                    actie={verwijderRelatie}
                    velden={{ id: r.id }}
                    bevestiging={`Relatie "${naamVan.get(r.van_entiteit)} is eigenaar van ${naamVan.get(r.naar_entiteit)}" verwijderen?`}
                    naAfloop={herlaad}
                  />
                </li>
              ))}
            </ul>
          )}

          {entiteiten.length >= 2 && (
            <div className="border-rand border-t pt-4">
              <Formulier actie={maakRelatie} knop="Relatie toevoegen" naAfloop={herlaad}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Keuze naam="van_entiteit" label="Eigenaar" opties={opties} verplicht />
                  <Keuze
                    naam="naar_entiteit"
                    label="Is eigenaar van"
                    opties={opties}
                    verplicht
                  />
                </div>
              </Formulier>
            </div>
          )}
        </div>
      </Sectie>
    </div>
  );
}
