'use client';

import Formulier from '@/components/beheer/Formulier';
import { Keuze, Leeg, Sectie, Veld } from '@/components/beheer/velden';
import { maakGebruiker, zetRol, zetToegang, zetWachtwoord } from '@/lib/acties';
import { useGebruiker } from '@/lib/auth';
import { ofFout, useGegevens } from '@/lib/gegevens';
import { supabaseBrowser } from '@/lib/supabase/client';
import { SOORT_LABEL, type Entiteit, type Gebruiker, type Soort } from '@/lib/types';

const ROL_OPTIES = [
  { waarde: 'lezer', label: 'Lezer' },
  { waarde: 'beheerder', label: 'Beheerder' },
];

const SOORT_ORDE: Soort[] = ['persoon', 'eenmanszaak', 'holding', 'werkmaatschappij'];

export default function Gebruikers() {
  const ik = useGebruiker();

  const { data, bezig, fout, herlaad } = useGegevens('beheer-gebruikers', async () => {
    const db = supabaseBrowser();
    const [gebruikers, entiteiten, toegang] = await Promise.all([
      ofFout<Gebruiker[]>(db.from('kaart_gebruikers').select('*').order('email')),
      ofFout<Entiteit[]>(db.from('kaart_entiteiten').select('*').order('naam')),
      ofFout<Array<{ gebruiker_id: string; entiteit_id: string }>>(
        db.from('kaart_toegang').select('*')
      ),
    ]);
    return { gebruikers, entiteiten, toegang };
  });

  if (fout) return <Leeg tekst={`Ophalen mislukt: ${fout}`} />;
  if (bezig || !data) return <Leeg tekst="Bezig met laden..." />;

  const { gebruikers, entiteiten, toegang } = data;

  const toegangPerGebruiker = new Map<string, Set<string>>();
  for (const t of toegang) {
    const set = toegangPerGebruiker.get(t.gebruiker_id) ?? new Set<string>();
    set.add(t.entiteit_id);
    toegangPerGebruiker.set(t.gebruiker_id, set);
  }

  return (
    <div className="space-y-6">
      <Sectie
        titel="Gebruiker toevoegen"
        toelichting="Je kiest zelf het eerste wachtwoord en geeft dat door. Er gaat geen e-mail uit. Diegene kan het daarna zelf wijzigen onder Mijn account."
      >
        <Formulier
          actie={maakGebruiker}
          knop="Gebruiker toevoegen"
          naAfloop={herlaad}
          leegNaAfloop
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Veld naam="email" label="E-mailadres" type="email" verplicht />
            <Veld naam="naam" label="Naam" />
            <Veld
              naam="wachtwoord"
              label="Eerste wachtwoord"
              type="text"
              verplicht
              hint="Minstens 10 tekens. Geef dit zelf door, bijvoorbeeld in een gesprek."
            />
            <Keuze naam="rol" label="Rol" opties={ROL_OPTIES} verplicht />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Toegang tot onderdelen
              <span className="text-inkt-zacht font-normal">
                {' '}
                (niet nodig bij de rol beheerder, die ziet alles)
              </span>
            </legend>
            <OnderdelenKeuze entiteiten={entiteiten} aangevinkt={new Set()} />
          </fieldset>
        </Formulier>
      </Sectie>

      <Sectie
        titel="Gebruikers"
        toelichting={`${gebruikers.length} ${gebruikers.length === 1 ? 'gebruiker' : 'gebruikers'}. Een lezer ziet uitsluitend de aangevinkte onderdelen.`}
      >
        {gebruikers.length === 0 ? (
          <Leeg tekst="Nog geen gebruikers." />
        ) : (
          <ul className="space-y-4">
            {gebruikers.map((g) => {
              const aangevinkt =
                toegangPerGebruiker.get(g.gebruiker_id) ?? new Set<string>();
              const ikZelf = g.gebruiker_id === ik?.gebruikerId;

              return (
                <li key={g.gebruiker_id} className="border-rand rounded-md border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">
                        {g.naam || g.email}
                        {ikZelf && (
                          <span className="text-inkt-zacht font-normal"> (jij)</span>
                        )}
                      </div>
                      <div className="text-inkt-zacht text-xs">{g.email}</div>
                      <div className="text-inkt-zacht mt-1 text-xs">
                        {g.rol === 'beheerder'
                          ? 'Beheerder, ziet en wijzigt alles'
                          : `Lezer, ${aangevinkt.size} ${aangevinkt.size === 1 ? 'onderdeel' : 'onderdelen'} zichtbaar`}
                      </div>
                    </div>

                    {!ikZelf && (
                      <Formulier
                        actie={zetRol}
                        knop="Rol opslaan"
                        stil
                        klasse="flex flex-wrap items-end gap-3"
                        naAfloop={herlaad}
                      >
                        <input type="hidden" name="gebruiker_id" value={g.gebruiker_id} />
                        <div className="w-44">
                          <Keuze naam="rol" label="Rol" waarde={g.rol} opties={ROL_OPTIES} />
                        </div>
                      </Formulier>
                    )}
                  </div>

                  <details className="mt-3">
                    <summary className="text-groen-700 cursor-pointer text-sm font-medium">
                      Wachtwoord opnieuw zetten
                    </summary>
                    <div className="mt-3">
                      <Formulier actie={zetWachtwoord} knop="Wachtwoord zetten" leegNaAfloop>
                        <input type="hidden" name="gebruiker_id" value={g.gebruiker_id} />
                        <div className="max-w-sm">
                          <Veld
                            naam="wachtwoord"
                            label="Nieuw wachtwoord"
                            type="text"
                            verplicht
                            hint="Minstens 10 tekens. Geef het daarna zelf door."
                          />
                        </div>
                      </Formulier>
                    </div>
                  </details>

                  {g.rol === 'lezer' && (
                    <details className="mt-3">
                      <summary className="text-groen-700 cursor-pointer text-sm font-medium">
                        Toegang aanpassen
                      </summary>
                      <div className="mt-3">
                        <Formulier actie={zetToegang} knop="Toegang opslaan" naAfloop={herlaad}>
                          <input
                            type="hidden"
                            name="gebruiker_id"
                            value={g.gebruiker_id}
                          />
                          <OnderdelenKeuze
                            entiteiten={entiteiten}
                            aangevinkt={aangevinkt}
                          />
                        </Formulier>
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Sectie>

      <Sectie titel="Hoe de toegang werkt">
        <ul className="text-inkt-zacht list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>
            Een beheerder ziet en wijzigt alles. Vinkjes zijn voor die rol niet nodig.
          </li>
          <li>
            Een lezer ziet uitsluitend de aangevinkte onderdelen, met de processen,
            taken, documenten en contactpersonen daarvan.
          </li>
          <li>
            Een verbindingslijn is alleen zichtbaar als beide uiteinden zichtbaar zijn.
            Een lezer ziet dus geen lijn naar een onderdeel dat hij niet mag zien.
          </li>
          <li>
            Dit wordt in de database afgedwongen met Row Level Security. Ook wie
            rechtstreeks de API aanroept, krijgt niets terug waar hij geen toegang toe
            heeft.
          </li>
          <li>
            Je eigen rol kun je hier niet wijzigen; dat moet een andere beheerder doen.
          </li>
        </ul>
      </Sectie>
    </div>
  );
}

function OnderdelenKeuze({
  entiteiten,
  aangevinkt,
}: {
  entiteiten: Entiteit[];
  aangevinkt: Set<string>;
}) {
  return (
    <div className="space-y-3">
      {SOORT_ORDE.map((soort) => {
        const groep = entiteiten.filter((e) => e.soort === soort);
        if (groep.length === 0) return null;
        return (
          <div key={soort}>
            <div className="text-inkt-zacht mb-1.5 text-[11px] font-semibold tracking-wide uppercase">
              {SOORT_LABEL[soort]}
            </div>
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {groep.map((e) => (
                <label
                  key={e.id}
                  className="hover:bg-groen-50 flex min-h-11 items-center gap-2.5 rounded px-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    name="entiteit_id"
                    value={e.id}
                    defaultChecked={aangevinkt.has(e.id)}
                    className="accent-groen-700 h-4 w-4 shrink-0"
                  />
                  <span className="truncate">{e.naam}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
