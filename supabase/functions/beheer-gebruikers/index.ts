/**
 * Edge function: gebruikers aanmaken en wachtwoorden zetten.
 *
 * De bedrijfskaart is een statische site op GitHub Pages. Alles wat de browser
 * mag doen, doet de browser rechtstreeks tegen de database, waar Row Level
 * Security de grens bewaakt. Twee dingen kunnen daar niet: een account aanmaken
 * en een wachtwoord zetten. Dat vraagt de geheime sleutel, en die mag niet in
 * een openbare pagina staan.
 *
 * Daarom draait dit stukje bij Supabase zelf. Het controleert eerst, met het
 * token van de aanvrager, of die beheerder is. Pas daarna gebruikt het de
 * geheime sleutel, die Supabase als omgevingsvariabele meegeeft en die deze
 * functie nooit teruggeeft.
 *
 * Uitrollen:  npx supabase functions deploy beheer-gebruikers
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const anonSleutel = Deno.env.get('SUPABASE_ANON_KEY')!;
const geheimeSleutel = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Vanaf welke adressen de browser deze functie mag aanroepen. */
const TOEGESTANE_HERKOMST = (Deno.env.get('KAART_HERKOMST') ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

function corsKoppen(herkomst: string | null): Record<string, string> {
  const magHet =
    TOEGESTANE_HERKOMST.length === 0 ||
    (herkomst !== null && TOEGESTANE_HERKOMST.includes(herkomst));
  return {
    'Access-Control-Allow-Origin': magHet && herkomst ? herkomst : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function antwoord(lichaam: unknown, status: number, herkomst: string | null): Response {
  return new Response(JSON.stringify(lichaam), {
    status,
    headers: { ...corsKoppen(herkomst), 'Content-Type': 'application/json' },
  });
}

type Opdracht =
  | {
      opdracht: 'maak-gebruiker';
      email: string;
      naam: string | null;
      rol: 'beheerder' | 'lezer';
      wachtwoord: string;
      entiteiten: string[];
    }
  | { opdracht: 'zet-wachtwoord'; gebruikerId: string; wachtwoord: string };

Deno.serve(async (verzoek) => {
  const herkomst = verzoek.headers.get('Origin');

  if (verzoek.method === 'OPTIONS') {
    return new Response('ok', { headers: corsKoppen(herkomst) });
  }
  if (verzoek.method !== 'POST') {
    return antwoord({ fout: 'Alleen POST.' }, 405, herkomst);
  }

  const autorisatie = verzoek.headers.get('Authorization');
  if (!autorisatie) {
    return antwoord({ fout: 'Je bent niet ingelogd.' }, 401, herkomst);
  }

  // Stap 1: wie vraagt dit, en is die beheerder? Dit gebeurt met het token van
  // de aanvrager zelf, dus onder Row Level Security.
  const alsAanvrager = createClient(url, anonSleutel, {
    global: { headers: { Authorization: autorisatie } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: gebruikerFout,
  } = await alsAanvrager.auth.getUser();
  if (gebruikerFout || !user) {
    return antwoord({ fout: 'Je bent niet ingelogd.' }, 401, herkomst);
  }

  const { data: isBeheerder, error: rolFout } = await alsAanvrager.rpc('kaart_is_beheerder');
  if (rolFout) {
    return antwoord({ fout: `Rol controleren mislukt: ${rolFout.message}` }, 500, herkomst);
  }
  if (isBeheerder !== true) {
    return antwoord({ fout: 'Alleen een beheerder mag dit doen.' }, 403, herkomst);
  }

  // Stap 2: pas nu de geheime sleutel.
  const alsBeheer = createClient(url, geheimeSleutel, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let opdracht: Opdracht;
  try {
    opdracht = (await verzoek.json()) as Opdracht;
  } catch {
    return antwoord({ fout: 'Onleesbare opdracht.' }, 400, herkomst);
  }

  try {
    if (opdracht.opdracht === 'zet-wachtwoord') {
      if (!opdracht.gebruikerId || (opdracht.wachtwoord ?? '').length < 10) {
        return antwoord(
          { fout: 'Kies een wachtwoord van minstens 10 tekens.' },
          400,
          herkomst
        );
      }
      const { error } = await alsBeheer.auth.admin.updateUserById(opdracht.gebruikerId, {
        password: opdracht.wachtwoord,
      });
      if (error) throw new Error(error.message);
      return antwoord(
        { melding: 'Wachtwoord gezet. Geef het door; diegene kan het daarna zelf wijzigen.' },
        200,
        herkomst
      );
    }

    if (opdracht.opdracht === 'maak-gebruiker') {
      const email = (opdracht.email ?? '').toLowerCase().trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return antwoord({ fout: 'Vul een geldig e-mailadres in.' }, 400, herkomst);
      }
      if ((opdracht.wachtwoord ?? '').length < 10) {
        return antwoord(
          { fout: 'Kies een wachtwoord van minstens 10 tekens.' },
          400,
          herkomst
        );
      }
      const rol = opdracht.rol === 'beheerder' ? 'beheerder' : 'lezer';

      const { data: nieuw, error: maakFout } = await alsBeheer.auth.admin.createUser({
        email,
        password: opdracht.wachtwoord,
        email_confirm: true,
        user_metadata: opdracht.naam ? { naam: opdracht.naam } : undefined,
      });

      if (maakFout || !nieuw?.user) {
        const melding = maakFout?.message ?? 'onbekende fout';
        const bestaatAl =
          melding.toLowerCase().includes('already been registered') ||
          melding.toLowerCase().includes('already exists');
        return antwoord(
          {
            fout: bestaatAl
              ? `Er bestaat al een account met ${email}. Die staat in de lijst hieronder; daar kun je de rol, de toegang en het wachtwoord aanpassen.`
              : `Gebruiker aanmaken mislukt: ${melding}`,
          },
          400,
          herkomst
        );
      }

      const gebruikerId = nieuw.user.id;

      const { error: rolZetFout } = await alsBeheer
        .from('kaart_gebruikers')
        .upsert(
          { gebruiker_id: gebruikerId, email, naam: opdracht.naam, rol },
          { onConflict: 'gebruiker_id' }
        );
      if (rolZetFout) throw new Error(`Rol instellen mislukt: ${rolZetFout.message}`);

      const entiteiten = Array.isArray(opdracht.entiteiten) ? opdracht.entiteiten : [];
      if (entiteiten.length > 0) {
        const { error: toegangFout } = await alsBeheer.from('kaart_toegang').upsert(
          entiteiten.map((entiteitId) => ({
            gebruiker_id: gebruikerId,
            entiteit_id: entiteitId,
          })),
          { onConflict: 'gebruiker_id,entiteit_id' }
        );
        if (toegangFout) throw new Error(`Toegang instellen mislukt: ${toegangFout.message}`);
      }

      return antwoord(
        {
          melding: `${email} is aangemaakt. Geef het wachtwoord zelf door; diegene kan het daarna wijzigen onder Mijn account.`,
        },
        200,
        herkomst
      );
    }

    return antwoord({ fout: 'Onbekende opdracht.' }, 400, herkomst);
  } catch (fout) {
    const melding = fout instanceof Error ? fout.message : 'Onbekende fout.';
    return antwoord({ fout: melding }, 500, herkomst);
  }
});
