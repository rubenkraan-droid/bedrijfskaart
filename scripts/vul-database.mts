/**
 * Vult de bedrijfskaart met de beginstructuur: onderdelen en eigendomsrelaties.
 *
 * Draaien:  npm run vul-database
 *
 * De structuur staat in scripts/structuur.json. Dat bestand staat met opzet in
 * .gitignore, want deze repository is openbaar en de namen van de bedrijven en
 * de aandeelhouders horen daar niet in. Zie scripts/structuur.voorbeeld.json
 * voor de opbouw.
 *
 * Het script is idempotent. Onderdelen worden herkend op naam, relaties op het
 * paar van en naar. Bestaande omschrijvingen en posities blijven staan, zodat je
 * het script opnieuw kunt draaien zonder jouw aanpassingen te overschrijven.
 * Gebruik --overschrijf om omschrijvingen en beginposities wel terug te zetten.
 *
 * Draait met de geheime sleutel en gaat dus buiten Row Level Security om.
 * Nooit vanuit de browser gebruiken.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';

config({ path: '.env.local', quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Ontbrekende omgevingsvariabelen. Zet NEXT_PUBLIC_SUPABASE_URL en\n' +
      'SUPABASE_SECRET_KEY in .env.local. Zie de README.'
  );
  process.exit(1);
}

type Soort = 'persoon' | 'holding' | 'werkmaatschappij';

type Onderdeel = {
  naam: string;
  soort: Soort;
  korte_omschrijving: string;
  positie_x: number;
  positie_y: number;
};

type Structuur = {
  onderdelen: Onderdeel[];
  relaties: Array<[van: string, naar: string]>;
};

function leesStructuur(): Structuur {
  try {
    const ruw = readFileSync(new URL('./structuur.json', import.meta.url), 'utf8');
    const data = JSON.parse(ruw) as Structuur;
    if (!Array.isArray(data.onderdelen) || !Array.isArray(data.relaties)) {
      throw new Error('onderdelen of relaties ontbreekt');
    }
    return data;
  } catch (fout) {
    const reden = fout instanceof Error ? fout.message : String(fout);
    console.error(
      `scripts/structuur.json kon niet gelezen worden (${reden}).\n` +
        'Kopieer scripts/structuur.voorbeeld.json naar scripts/structuur.json en\n' +
        'vul daar je eigen onderdelen en eigendomsrelaties in.'
    );
    process.exit(1);
  }
}

const { onderdelen: ONDERDELEN, relaties: RELATIES } = leesStructuur();

const overschrijf = process.argv.includes('--overschrijf');

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(`Vullen van ${url}`);
  console.log(
    overschrijf
      ? 'Modus: overschrijven, omschrijvingen en beginposities worden teruggezet.'
      : 'Modus: aanvullen, bestaande omschrijvingen en posities blijven staan.'
  );

  // --- Onderdelen ---------------------------------------------------------
  const { data: bestaand, error: leesFout } = await db
    .from('kaart_entiteiten')
    .select('id, naam');
  if (leesFout) throw leesFout;

  const idVanNaam = new Map((bestaand ?? []).map((e) => [e.naam, e.id as string]));

  const nieuw = ONDERDELEN.filter((o) => !idVanNaam.has(o.naam));
  if (nieuw.length > 0) {
    const { data, error } = await db
      .from('kaart_entiteiten')
      .insert(nieuw)
      .select('id, naam');
    if (error) throw error;
    for (const e of data ?? []) idVanNaam.set(e.naam, e.id as string);
  }
  console.log(`Onderdelen: ${nieuw.length} toegevoegd, ${idVanNaam.size} in totaal.`);

  if (overschrijf) {
    for (const o of ONDERDELEN) {
      const { error } = await db
        .from('kaart_entiteiten')
        .update({
          soort: o.soort,
          korte_omschrijving: o.korte_omschrijving,
          positie_x: o.positie_x,
          positie_y: o.positie_y,
        })
        .eq('naam', o.naam);
      if (error) throw error;
    }
    console.log(`Onderdelen: ${ONDERDELEN.length} bijgewerkt.`);
  }

  // --- Relaties -----------------------------------------------------------
  const { data: bestaandeRelaties, error: relFout } = await db
    .from('kaart_relaties')
    .select('van_entiteit, naar_entiteit');
  if (relFout) throw relFout;

  const alAanwezig = new Set(
    (bestaandeRelaties ?? []).map((r) => `${r.van_entiteit}>${r.naar_entiteit}`)
  );

  const teZetten = RELATIES.map(([van, naar]) => {
    const vanId = idVanNaam.get(van);
    const naarId = idVanNaam.get(naar);
    if (!vanId) throw new Error(`Onbekend onderdeel in relatie: "${van}"`);
    if (!naarId) throw new Error(`Onbekend onderdeel in relatie: "${naar}"`);
    return { van_entiteit: vanId, naar_entiteit: naarId, soort: 'eigenaar_van' as const };
  }).filter((r) => !alAanwezig.has(`${r.van_entiteit}>${r.naar_entiteit}`));

  if (teZetten.length > 0) {
    const { error } = await db.from('kaart_relaties').insert(teZetten);
    if (error) throw error;
  }
  console.log(
    `Relaties: ${teZetten.length} toegevoegd, ${alAanwezig.size + teZetten.length} in totaal.`
  );

  console.log('\nKlaar. Processen, taken, documenten en contactpersonen zijn leeg gelaten;');
  console.log('die vul je via het beheerscherm.');
}

main().catch((fout) => {
  console.error('Vullen mislukt:', fout.message ?? fout);
  process.exit(1);
});
