'use client';

import { supabaseBrowser } from './supabase/client';
import type { Rol, Soort, Taakstatus, Uitvoering } from './types';

/**
 * Alle wijzigingen die het beheerscherm doet.
 *
 * De site is statisch, dus dit draait in de browser. Dat is veilig omdat Row
 * Level Security de grens bewaakt: een lezer die deze aanroepen nadoet, raakt
 * geen enkele rij. Dat is nagegaan met npm run test:rls.
 *
 * De twee dingen die niet in de browser kunnen, een account aanmaken en een
 * wachtwoord zetten, gaan via de edge function beheer-gebruikers. Die draait bij
 * Supabase en houdt de geheime sleutel daar.
 */

export type Uitkomst = { ok: true; melding?: string } | { ok: false; fout: string };

export function tekst(data: FormData, naam: string): string {
  const waarde = data.get(naam);
  return typeof waarde === 'string' ? waarde.trim() : '';
}

function tekstOfNull(data: FormData, naam: string): string | null {
  const waarde = tekst(data, naam);
  return waarde === '' ? null : waarde;
}

function getal(data: FormData, naam: string, standaard = 0): number {
  const n = Number(tekst(data, naam));
  return Number.isFinite(n) ? n : standaard;
}

function lijst(data: FormData, naam: string): string[] {
  return data.getAll(naam).filter((w): w is string => typeof w === 'string');
}

/** Zet een foutmelding van de database om in iets begrijpelijks. */
function duidelijk(bericht: string): string {
  if (bericht.includes('kaart_entiteiten_naam_key')) {
    return 'Er bestaat al een onderdeel met deze naam.';
  }
  if (bericht.includes('kaart_relaties_uniek')) return 'Deze eigendomsrelatie bestaat al.';
  if (bericht.includes('kaart_relaties_niet_naar_zichzelf')) {
    return 'Een onderdeel kan geen eigenaar van zichzelf zijn.';
  }
  if (bericht.includes('kaart_documenten_url_is_link')) {
    return 'De URL moet beginnen met http:// of https://.';
  }
  if (bericht.includes('kaart_toegang_pkey')) {
    return 'Deze gebruiker had al toegang tot dit onderdeel.';
  }
  if (bericht.toLowerCase().includes('row-level security')) {
    return 'De database heeft dit geweigerd. Je hebt hier geen rechten voor.';
  }
  return bericht;
}

async function voerUit(werk: () => Promise<string>): Promise<Uitkomst> {
  try {
    return { ok: true, melding: await werk() };
  } catch (e) {
    return { ok: false, fout: e instanceof Error ? duidelijk(e.message) : 'Onbekende fout.' };
  }
}

async function schrijf(
  werk: () => PromiseLike<{ error: { message: string } | null }>,
  wat: string
) {
  const { error } = await werk();
  if (error) throw new Error(`${wat} mislukt: ${duidelijk(error.message)}`);
}

const db = () => supabaseBrowser();

// ---------------------------------------------------------------------------
// Onderdelen
// ---------------------------------------------------------------------------

export function maakOnderdeel(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () =>
        db().from('kaart_entiteiten').insert({
          naam: tekst(data, 'naam'),
          soort: tekst(data, 'soort') as Soort,
          korte_omschrijving: tekstOfNull(data, 'korte_omschrijving'),
          positie_x: getal(data, 'positie_x'),
          positie_y: getal(data, 'positie_y'),
        }),
      'Onderdeel toevoegen'
    );
    return `Onderdeel "${tekst(data, 'naam')}" toegevoegd.`;
  });
}

export function wijzigOnderdeel(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () =>
        db()
          .from('kaart_entiteiten')
          .update({
            naam: tekst(data, 'naam'),
            soort: tekst(data, 'soort') as Soort,
            korte_omschrijving: tekstOfNull(data, 'korte_omschrijving'),
            uitgebreide_omschrijving: tekstOfNull(data, 'uitgebreide_omschrijving'),
            positie_x: getal(data, 'positie_x'),
            positie_y: getal(data, 'positie_y'),
          })
          .eq('id', tekst(data, 'id')),
      'Onderdeel wijzigen'
    );
    return 'Wijzigingen opgeslagen.';
  });
}

export function verwijderOnderdeel(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () => db().from('kaart_entiteiten').delete().eq('id', tekst(data, 'id')),
      'Onderdeel verwijderen'
    );
    return 'Onderdeel verwijderd, met alles wat eraan hing.';
  });
}

// ---------------------------------------------------------------------------
// Relaties
// ---------------------------------------------------------------------------

export function maakRelatie(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () =>
        db().from('kaart_relaties').insert({
          van_entiteit: tekst(data, 'van_entiteit'),
          naar_entiteit: tekst(data, 'naar_entiteit'),
          soort: 'eigenaar_van',
        }),
      'Relatie toevoegen'
    );
    return 'Eigendomsrelatie toegevoegd.';
  });
}

export function verwijderRelatie(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () => db().from('kaart_relaties').delete().eq('id', tekst(data, 'id')),
      'Relatie verwijderen'
    );
    return 'Eigendomsrelatie verwijderd.';
  });
}

// ---------------------------------------------------------------------------
// Processen en stappen
// ---------------------------------------------------------------------------

export function maakProces(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () =>
        db().from('kaart_processen').insert({
          entiteit_id: tekst(data, 'entiteit_id'),
          titel: tekst(data, 'titel'),
          beschrijving: tekstOfNull(data, 'beschrijving'),
          volgorde: getal(data, 'volgorde'),
        }),
      'Proces toevoegen'
    );
    return 'Proces toegevoegd.';
  });
}

export function wijzigProces(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () =>
        db()
          .from('kaart_processen')
          .update({
            titel: tekst(data, 'titel'),
            beschrijving: tekstOfNull(data, 'beschrijving'),
            volgorde: getal(data, 'volgorde'),
          })
          .eq('id', tekst(data, 'id')),
      'Proces wijzigen'
    );
    return 'Proces opgeslagen.';
  });
}

export function verwijderProces(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () => db().from('kaart_processen').delete().eq('id', tekst(data, 'id')),
      'Proces verwijderen'
    );
    return 'Proces verwijderd, met zijn stappen.';
  });
}

export function maakStap(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () =>
        db().from('kaart_processtappen').insert({
          proces_id: tekst(data, 'proces_id'),
          titel: tekst(data, 'titel'),
          beschrijving: tekstOfNull(data, 'beschrijving'),
          uitvoering: tekst(data, 'uitvoering') as Uitvoering,
          toelichting: tekstOfNull(data, 'toelichting'),
          volgorde: getal(data, 'volgorde'),
        }),
      'Stap toevoegen'
    );
    return 'Stap toegevoegd.';
  });
}

export function wijzigStap(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () =>
        db()
          .from('kaart_processtappen')
          .update({
            titel: tekst(data, 'titel'),
            beschrijving: tekstOfNull(data, 'beschrijving'),
            uitvoering: tekst(data, 'uitvoering') as Uitvoering,
            toelichting: tekstOfNull(data, 'toelichting'),
            volgorde: getal(data, 'volgorde'),
          })
          .eq('id', tekst(data, 'id')),
      'Stap wijzigen'
    );
    return 'Stap opgeslagen.';
  });
}

export function verwijderStap(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () => db().from('kaart_processtappen').delete().eq('id', tekst(data, 'id')),
      'Stap verwijderen'
    );
    return 'Stap verwijderd.';
  });
}

// ---------------------------------------------------------------------------
// Taken, documenten, contactpersonen
// ---------------------------------------------------------------------------

export function maakTaak(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () =>
        db().from('kaart_taken').insert({
          entiteit_id: tekst(data, 'entiteit_id'),
          titel: tekst(data, 'titel'),
          verantwoordelijke: tekstOfNull(data, 'verantwoordelijke'),
          status: tekst(data, 'status') as Taakstatus,
          deadline: tekstOfNull(data, 'deadline'),
        }),
      'Taak toevoegen'
    );
    return 'Taak toegevoegd.';
  });
}

export function wijzigTaak(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () =>
        db()
          .from('kaart_taken')
          .update({
            titel: tekst(data, 'titel'),
            verantwoordelijke: tekstOfNull(data, 'verantwoordelijke'),
            status: tekst(data, 'status') as Taakstatus,
            deadline: tekstOfNull(data, 'deadline'),
          })
          .eq('id', tekst(data, 'id')),
      'Taak wijzigen'
    );
    return 'Taak opgeslagen.';
  });
}

export function verwijderTaak(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () => db().from('kaart_taken').delete().eq('id', tekst(data, 'id')),
      'Taak verwijderen'
    );
    return 'Taak verwijderd.';
  });
}

export function maakDocument(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () =>
        db().from('kaart_documenten').insert({
          entiteit_id: tekst(data, 'entiteit_id'),
          titel: tekst(data, 'titel'),
          url: tekst(data, 'url'),
        }),
      'Document toevoegen'
    );
    return 'Document toegevoegd.';
  });
}

export function verwijderDocument(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () => db().from('kaart_documenten').delete().eq('id', tekst(data, 'id')),
      'Document verwijderen'
    );
    return 'Document verwijderd.';
  });
}

export function maakContactpersoon(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () =>
        db().from('kaart_contactpersonen').insert({
          entiteit_id: tekst(data, 'entiteit_id'),
          naam: tekst(data, 'naam'),
          rol: tekstOfNull(data, 'rol'),
          email: tekstOfNull(data, 'email'),
          telefoon: tekstOfNull(data, 'telefoon'),
        }),
      'Contactpersoon toevoegen'
    );
    return 'Contactpersoon toegevoegd.';
  });
}

export function verwijderContactpersoon(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    await schrijf(
      () => db().from('kaart_contactpersonen').delete().eq('id', tekst(data, 'id')),
      'Contactpersoon verwijderen'
    );
    return 'Contactpersoon verwijderd.';
  });
}

// ---------------------------------------------------------------------------
// Gebruikers en toegang
// ---------------------------------------------------------------------------

export function zetRol(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    const rol = tekst(data, 'rol') as Rol;
    await schrijf(
      () =>
        db()
          .from('kaart_gebruikers')
          .update({ rol })
          .eq('gebruiker_id', tekst(data, 'gebruiker_id')),
      'Rol wijzigen'
    );
    return `Rol gezet op ${rol}.`;
  });
}

/** Zet de toegang van een gebruiker op precies de aangevinkte onderdelen. */
export function zetToegang(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    const gebruikerId = tekst(data, 'gebruiker_id');
    const gekozen = lijst(data, 'entiteit_id');

    await schrijf(
      () => db().from('kaart_toegang').delete().eq('gebruiker_id', gebruikerId),
      'Oude toegang opruimen'
    );

    if (gekozen.length > 0) {
      await schrijf(
        () =>
          db()
            .from('kaart_toegang')
            .insert(
              gekozen.map((entiteitId) => ({
                gebruiker_id: gebruikerId,
                entiteit_id: entiteitId,
              }))
            ),
        'Toegang opslaan'
      );
    }

    return gekozen.length === 0
      ? 'Toegang ingetrokken. Deze gebruiker ziet nu niets.'
      : `Toegang opgeslagen: ${gekozen.length} ${gekozen.length === 1 ? 'onderdeel' : 'onderdelen'}.`;
  });
}

/**
 * Roept de edge function aan die bij Supabase draait. Die controleert zelf of de
 * aanvrager beheerder is en gebruikt daarna de geheime sleutel, die daar blijft
 * en dus nooit in deze openbare code of in de browser staat.
 */
async function roepBeheerAan(opdracht: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabaseBrowser().functions.invoke('beheer-gebruikers', {
    body: opdracht,
  });

  if (error) {
    // De tekst van de functie zelf staat in het antwoord, die is bruikbaarder
    // dan "Edge Function returned a non-2xx status code".
    let melding = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      try {
        const lichaam = (await context.json()) as { fout?: string };
        if (lichaam?.fout) melding = lichaam.fout;
      } catch {
        // Geen bruikbaar antwoord, dan blijft de oorspronkelijke melding staan.
      }
    }
    throw new Error(melding);
  }

  const antwoord = data as { fout?: string; melding?: string } | null;
  if (antwoord?.fout) throw new Error(antwoord.fout);
  return antwoord?.melding ?? 'Gelukt.';
}

export function maakGebruiker(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    const email = tekst(data, 'email').toLowerCase();
    const wachtwoord = tekst(data, 'wachtwoord');

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new Error('Vul een geldig e-mailadres in.');
    }
    if (wachtwoord.length < 10) {
      throw new Error('Kies een wachtwoord van minstens 10 tekens.');
    }

    return roepBeheerAan({
      opdracht: 'maak-gebruiker',
      email,
      naam: tekstOfNull(data, 'naam'),
      rol: tekst(data, 'rol') || 'lezer',
      wachtwoord,
      entiteiten: lijst(data, 'entiteit_id'),
    });
  });
}

export function zetWachtwoord(_v: Uitkomst | null, data: FormData) {
  return voerUit(async () => {
    const wachtwoord = tekst(data, 'wachtwoord');
    if (wachtwoord.length < 10) {
      throw new Error('Kies een wachtwoord van minstens 10 tekens.');
    }
    return roepBeheerAan({
      opdracht: 'zet-wachtwoord',
      gebruikerId: tekst(data, 'gebruiker_id'),
      wachtwoord,
    });
  });
}
