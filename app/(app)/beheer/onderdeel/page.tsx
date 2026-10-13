'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Formulier, { VerwijderKnop } from '@/components/beheer/Formulier';
import { Keuze, Leeg, Sectie, Tekstvak, Veld } from '@/components/beheer/velden';
import {
  maakContactpersoon,
  maakDocument,
  maakProces,
  maakRelatie,
  maakStap,
  maakTaak,
  verwijderContactpersoon,
  verwijderDocument,
  verwijderProces,
  verwijderRelatie,
  verwijderStap,
  verwijderTaak,
  wijzigOnderdeel,
  wijzigProces,
  wijzigStap,
  wijzigTaak,
} from '@/lib/acties';
import { ofFout, useGegevens } from '@/lib/gegevens';
import { supabaseBrowser } from '@/lib/supabase/client';
import {
  SOORT_LABEL,
  STATUS_LABEL,
  UITVOERING_LABEL,
  type Contactpersoon,
  type Document,
  type Entiteit,
  type ProcesMetStappen,
  type Relatie,
  type Taak,
} from '@/lib/types';

const SOORT_OPTIES = [
  { waarde: 'persoon', label: 'Persoon' },
  { waarde: 'holding', label: 'Holding' },
  { waarde: 'werkmaatschappij', label: 'Werkmaatschappij' },
];

const UITVOERING_OPTIES = [
  { waarde: 'handmatig', label: 'Handmatig, een medewerker doet dit' },
  { waarde: 'automatisch', label: 'Automatisch, koppeling of automatisering' },
];

const STATUS_OPTIES = [
  { waarde: 'open', label: 'Open' },
  { waarde: 'bezig', label: 'Bezig' },
  { waarde: 'gereed', label: 'Gereed' },
  { waarde: 'geblokkeerd', label: 'Geblokkeerd' },
];

export default function OnderdeelBeheerPagina() {
  return (
    <Suspense fallback={<Leeg tekst="Bezig met laden..." />}>
      <OnderdeelBeheer />
    </Suspense>
  );
}

function OnderdeelBeheer() {
  const id = useSearchParams().get('id') ?? '';

  const { data, bezig, fout, herlaad } = useGegevens(`onderdeel-${id}`, async () => {
    if (!id) return null;
    const db = supabaseBrowser();
    const [entiteit, alle, relaties, processen, taken, documenten, contacten] =
      await Promise.all([
        db.from('kaart_entiteiten').select('*').eq('id', id).maybeSingle(),
        ofFout<Array<{ id: string; naam: string }>>(
          db.from('kaart_entiteiten').select('id, naam').order('naam')
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
          db.from('kaart_taken').select('*').eq('entiteit_id', id).order('titel')
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
      alle,
      relaties,
      processen,
      taken,
      documenten,
      contacten,
    };
  });

  if (!id) return <Leeg tekst="Geen onderdeel gekozen." />;
  if (fout) return <Leeg tekst={`Ophalen mislukt: ${fout}`} />;
  if (bezig || !data) return <Leeg tekst="Bezig met laden..." />;
  if (!data.entiteit) {
    return <Leeg tekst="Dit onderdeel bestaat niet, of je hebt er geen toegang toe." />;
  }

  const { entiteit, alle, relaties, processen, taken, documenten, contacten } = data;
  const naamVan = new Map(alle.map((e) => [e.id, e.naam]));
  const eigenaren = relaties.filter((r) => r.naar_entiteit === id);
  const bezittingen = relaties.filter((r) => r.van_entiteit === id);
  const anderen = alle
    .filter((e) => e.id !== id)
    .map((e) => ({ waarde: e.id, label: e.naam }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/beheer"
          className="text-inkt-zacht hover:text-groen-800 text-sm underline underline-offset-4"
        >
          Terug naar alle onderdelen
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{entiteit.naam}</h1>
        <p className="text-inkt-zacht text-sm">{SOORT_LABEL[entiteit.soort]}</p>
      </div>

      <Sectie titel="Gegevens">
        <Formulier actie={wijzigOnderdeel} knop="Opslaan" naAfloop={herlaad}>
          <input type="hidden" name="id" value={entiteit.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Veld naam="naam" label="Naam" waarde={entiteit.naam} verplicht />
            <Keuze
              naam="soort"
              label="Soort"
              waarde={entiteit.soort}
              opties={SOORT_OPTIES}
              verplicht
            />
          </div>
          <Tekstvak
            naam="korte_omschrijving"
            label="Korte omschrijving"
            waarde={entiteit.korte_omschrijving}
            regels={2}
          />
          <Tekstvak
            naam="uitgebreide_omschrijving"
            label="Uitgebreide omschrijving"
            waarde={entiteit.uitgebreide_omschrijving}
            regels={6}
            plaatshouder="Uitleg die onder het tabblad Overzicht komt te staan."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Veld
              naam="positie_x"
              label="Positie x"
              type="number"
              waarde={entiteit.positie_x}
              hint="Verslepen op de kaart werkt ook en slaat de positie direct op."
            />
            <Veld
              naam="positie_y"
              label="Positie y"
              type="number"
              waarde={entiteit.positie_y}
            />
          </div>
        </Formulier>
      </Sectie>

      <Sectie
        titel="Eigendomsrelaties"
        toelichting="Wie dit onderdeel bezit, en wat dit onderdeel zelf bezit."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-inkt-zacht text-[11px] font-semibold tracking-wide uppercase">
              Eigendom van
            </h3>
            {eigenaren.length === 0 ? (
              <Leeg tekst="Geen eigenaren." />
            ) : (
              <ul className="divide-rand divide-y">
                {eigenaren.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 py-1">
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {naamVan.get(r.van_entiteit)}
                    </span>
                    <VerwijderKnop
                      actie={verwijderRelatie}
                      velden={{ id: r.id }}
                      bevestiging={`${naamVan.get(r.van_entiteit)} als eigenaar van ${entiteit.naam} verwijderen?`}
                      label="Los"
                      naAfloop={herlaad}
                    />
                  </li>
                ))}
              </ul>
            )}
            {anderen.length > 0 && (
              <Formulier
                actie={maakRelatie}
                knop="Eigenaar toevoegen"
                stil
                naAfloop={herlaad}
              >
                <input type="hidden" name="naar_entiteit" value={id} />
                <Keuze
                  naam="van_entiteit"
                  label="Nieuwe eigenaar"
                  opties={anderen}
                  verplicht
                />
              </Formulier>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-inkt-zacht text-[11px] font-semibold tracking-wide uppercase">
              Eigenaar van
            </h3>
            {bezittingen.length === 0 ? (
              <Leeg tekst="Geen deelnemingen." />
            ) : (
              <ul className="divide-rand divide-y">
                {bezittingen.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 py-1">
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {naamVan.get(r.naar_entiteit)}
                    </span>
                    <VerwijderKnop
                      actie={verwijderRelatie}
                      velden={{ id: r.id }}
                      bevestiging={`${entiteit.naam} als eigenaar van ${naamVan.get(r.naar_entiteit)} verwijderen?`}
                      label="Los"
                      naAfloop={herlaad}
                    />
                  </li>
                ))}
              </ul>
            )}
            {anderen.length > 0 && (
              <Formulier
                actie={maakRelatie}
                knop="Deelneming toevoegen"
                stil
                naAfloop={herlaad}
              >
                <input type="hidden" name="van_entiteit" value={id} />
                <Keuze
                  naam="naar_entiteit"
                  label="Wordt eigenaar van"
                  opties={anderen}
                  verplicht
                />
              </Formulier>
            )}
          </div>
        </div>
      </Sectie>

      <Sectie
        titel="Processen"
        toelichting="Per stap geef je aan of die automatisch verloopt of handmatig door een medewerker gebeurt."
      >
        <div className="space-y-5">
          {processen.length === 0 ? (
            <Leeg tekst="Nog geen processen." />
          ) : (
            processen.map((proces) => (
              <article key={proces.id} className="border-rand rounded-md border p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">{proces.titel}</h3>
                    {proces.beschrijving && (
                      <p className="text-inkt-zacht mt-0.5 text-sm">{proces.beschrijving}</p>
                    )}
                  </div>
                  <VerwijderKnop
                    actie={verwijderProces}
                    velden={{ id: proces.id }}
                    bevestiging={`Proces "${proces.titel}" verwijderen, met al zijn stappen?`}
                    naAfloop={herlaad}
                  />
                </div>

                <details className="mt-3">
                  <summary className="text-inkt-zacht hover:text-inkt cursor-pointer text-sm">
                    Proces wijzigen
                  </summary>
                  <div className="mt-3">
                    <Formulier
                      actie={wijzigProces}
                      knop="Proces opslaan"
                      stil
                      naAfloop={herlaad}
                    >
                      <input type="hidden" name="id" value={proces.id} />
                      <Veld naam="titel" label="Titel" waarde={proces.titel} verplicht />
                      <Tekstvak
                        naam="beschrijving"
                        label="Beschrijving"
                        waarde={proces.beschrijving}
                        regels={3}
                      />
                      <Veld
                        naam="volgorde"
                        label="Volgorde"
                        type="number"
                        waarde={proces.volgorde}
                      />
                    </Formulier>
                  </div>
                </details>

                <div className="mt-4 space-y-2">
                  <h4 className="text-inkt-zacht text-[11px] font-semibold tracking-wide uppercase">
                    Stappen
                  </h4>
                  {proces.stappen.length === 0 ? (
                    <p className="text-inkt-zacht text-sm">Nog geen stappen.</p>
                  ) : (
                    <ol className="space-y-2">
                      {proces.stappen.map((stap, i) => (
                        <li
                          key={stap.id}
                          className="border-rand bg-groen-50/40 rounded border px-3 py-2"
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-inkt-zacht mt-0.5 text-xs font-semibold">
                              {i + 1}.
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium">{stap.titel}</span>
                                <span className="text-inkt-zacht text-[10px] font-semibold tracking-wide uppercase">
                                  {UITVOERING_LABEL[stap.uitvoering]}
                                </span>
                              </div>
                              {stap.toelichting && (
                                <p className="text-inkt-zacht mt-0.5 text-xs">
                                  {stap.toelichting}
                                </p>
                              )}
                              <details className="mt-1.5">
                                <summary className="text-inkt-zacht hover:text-inkt cursor-pointer text-xs">
                                  Stap wijzigen
                                </summary>
                                <div className="mt-2">
                                  <Formulier
                                    actie={wijzigStap}
                                    knop="Stap opslaan"
                                    stil
                                    naAfloop={herlaad}
                                  >
                                    <input type="hidden" name="id" value={stap.id} />
                                    <Veld
                                      naam="titel"
                                      label="Titel"
                                      waarde={stap.titel}
                                      verplicht
                                    />
                                    <Tekstvak
                                      naam="beschrijving"
                                      label="Beschrijving"
                                      waarde={stap.beschrijving}
                                      regels={2}
                                    />
                                    <Keuze
                                      naam="uitvoering"
                                      label="Uitvoering"
                                      waarde={stap.uitvoering}
                                      opties={UITVOERING_OPTIES}
                                      verplicht
                                    />
                                    <Veld
                                      naam="toelichting"
                                      label="Toelichting"
                                      waarde={stap.toelichting}
                                      hint="Bij automatisch: welke koppeling. Bij handmatig: wie het doet."
                                    />
                                    <Veld
                                      naam="volgorde"
                                      label="Volgorde"
                                      type="number"
                                      waarde={stap.volgorde}
                                    />
                                  </Formulier>
                                </div>
                              </details>
                            </div>
                            <VerwijderKnop
                              actie={verwijderStap}
                              velden={{ id: stap.id }}
                              bevestiging={`Stap "${stap.titel}" verwijderen?`}
                              naAfloop={herlaad}
                            />
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}

                  <details>
                    <summary className="text-groen-700 cursor-pointer text-sm font-medium">
                      Stap toevoegen
                    </summary>
                    <div className="mt-3">
                      <Formulier
                        actie={maakStap}
                        knop="Stap toevoegen"
                        stil
                        naAfloop={herlaad}
                        leegNaAfloop
                      >
                        <input type="hidden" name="proces_id" value={proces.id} />
                        <Veld naam="titel" label="Titel" verplicht />
                        <Tekstvak naam="beschrijving" label="Beschrijving" regels={2} />
                        <Keuze
                          naam="uitvoering"
                          label="Uitvoering"
                          opties={UITVOERING_OPTIES}
                          verplicht
                        />
                        <Veld
                          naam="toelichting"
                          label="Toelichting"
                          hint="Bij automatisch: welke koppeling. Bij handmatig: wie het doet."
                        />
                        <Veld
                          naam="volgorde"
                          label="Volgorde"
                          type="number"
                          waarde={proces.stappen.length + 1}
                        />
                      </Formulier>
                    </div>
                  </details>
                </div>
              </article>
            ))
          )}

          <div className="border-rand border-t pt-4">
            <Formulier
              actie={maakProces}
              knop="Proces toevoegen"
              naAfloop={herlaad}
              leegNaAfloop
            >
              <input type="hidden" name="entiteit_id" value={id} />
              <Veld naam="titel" label="Titel" verplicht plaatshouder="Maandafsluiting" />
              <Tekstvak naam="beschrijving" label="Beschrijving" regels={2} />
              <Veld
                naam="volgorde"
                label="Volgorde"
                type="number"
                waarde={processen.length + 1}
              />
            </Formulier>
          </div>
        </div>
      </Sectie>

      <Sectie titel="Taken">
        <div className="space-y-4">
          {taken.length === 0 ? (
            <Leeg tekst="Nog geen taken." />
          ) : (
            <ul className="divide-rand divide-y">
              {taken.map((taak) => (
                <li key={taak.id} className="py-2">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{taak.titel}</div>
                      <div className="text-inkt-zacht text-xs">
                        {STATUS_LABEL[taak.status]}
                        {taak.verantwoordelijke && ` · ${taak.verantwoordelijke}`}
                        {taak.deadline && ` · ${taak.deadline}`}
                      </div>
                    </div>
                    <VerwijderKnop
                      actie={verwijderTaak}
                      velden={{ id: taak.id }}
                      bevestiging={`Taak "${taak.titel}" verwijderen?`}
                      naAfloop={herlaad}
                    />
                  </div>
                  <details className="mt-1">
                    <summary className="text-inkt-zacht hover:text-inkt cursor-pointer text-xs">
                      Taak wijzigen
                    </summary>
                    <div className="mt-2">
                      <Formulier
                        actie={wijzigTaak}
                        knop="Taak opslaan"
                        stil
                        naAfloop={herlaad}
                      >
                        <input type="hidden" name="id" value={taak.id} />
                        <Veld naam="titel" label="Titel" waarde={taak.titel} verplicht />
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Veld
                            naam="verantwoordelijke"
                            label="Verantwoordelijke"
                            waarde={taak.verantwoordelijke}
                          />
                          <Keuze
                            naam="status"
                            label="Status"
                            waarde={taak.status}
                            opties={STATUS_OPTIES}
                            verplicht
                          />
                          <Veld
                            naam="deadline"
                            label="Deadline"
                            type="date"
                            waarde={taak.deadline}
                          />
                        </div>
                      </Formulier>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}

          <div className="border-rand border-t pt-4">
            <Formulier
              actie={maakTaak}
              knop="Taak toevoegen"
              naAfloop={herlaad}
              leegNaAfloop
            >
              <input type="hidden" name="entiteit_id" value={id} />
              <Veld naam="titel" label="Titel" verplicht />
              <div className="grid gap-4 sm:grid-cols-3">
                <Veld naam="verantwoordelijke" label="Verantwoordelijke" />
                <Keuze naam="status" label="Status" opties={STATUS_OPTIES} verplicht />
                <Veld naam="deadline" label="Deadline" type="date" />
              </div>
            </Formulier>
          </div>
        </div>
      </Sectie>

      <Sectie titel="Documenten" toelichting="Verwijzingen naar documenten elders, als URL.">
        <div className="space-y-4">
          {documenten.length === 0 ? (
            <Leeg tekst="Nog geen documenten." />
          ) : (
            <ul className="divide-rand divide-y">
              {documenten.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 py-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{doc.titel}</div>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-inkt-zacht block truncate text-xs underline underline-offset-2"
                    >
                      {doc.url}
                    </a>
                  </div>
                  <VerwijderKnop
                    actie={verwijderDocument}
                    velden={{ id: doc.id }}
                    bevestiging={`Document "${doc.titel}" verwijderen?`}
                    naAfloop={herlaad}
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="border-rand border-t pt-4">
            <Formulier
              actie={maakDocument}
              knop="Document toevoegen"
              naAfloop={herlaad}
              leegNaAfloop
            >
              <input type="hidden" name="entiteit_id" value={id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Veld naam="titel" label="Titel" verplicht />
                <Veld
                  naam="url"
                  label="URL"
                  type="url"
                  verplicht
                  plaatshouder="https://..."
                  hint="Moet met http:// of https:// beginnen."
                />
              </div>
            </Formulier>
          </div>
        </div>
      </Sectie>

      <Sectie titel="Contactpersonen">
        <div className="space-y-4">
          {contacten.length === 0 ? (
            <Leeg tekst="Nog geen contactpersonen." />
          ) : (
            <ul className="divide-rand divide-y">
              {contacten.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{p.naam}</div>
                    <div className="text-inkt-zacht truncate text-xs">
                      {[p.rol, p.email, p.telefoon].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <VerwijderKnop
                    actie={verwijderContactpersoon}
                    velden={{ id: p.id }}
                    bevestiging={`Contactpersoon "${p.naam}" verwijderen?`}
                    naAfloop={herlaad}
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="border-rand border-t pt-4">
            <Formulier
              actie={maakContactpersoon}
              knop="Contactpersoon toevoegen"
              naAfloop={herlaad}
              leegNaAfloop
            >
              <input type="hidden" name="entiteit_id" value={id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Veld naam="naam" label="Naam" verplicht />
                <Veld naam="rol" label="Rol" plaatshouder="Boekhouder" />
                <Veld naam="email" label="E-mail" type="email" />
                <Veld naam="telefoon" label="Telefoon" type="tel" />
              </div>
            </Formulier>
          </div>
        </div>
      </Sectie>
    </div>
  );
}
