/**
 * Toegangstest: controleert dat Row Level Security echt dichthoudt.
 *
 * Draaien:  npm run test:rls
 *
 * De kernvraag die dit script beantwoordt: kan een lezer zonder toegang tot een
 * onderdeel die gegevens langs de voorkant om alsnog via de API opvragen? Het
 * antwoord moet nee zijn, en dat wordt hier per tabel nagegaan.
 *
 * Werkwijze:
 *  1. Met de service-role-sleutel worden twee tijdelijke gebruikers aangemaakt,
 *     een beheerder en een lezer, en wordt testinhoud geplaatst op twee
 *     onderdelen: een dat de lezer mag zien en een dat hij niet mag zien.
 *  2. Daarna wordt er ingelogd als die lezer met de gewone publieke sleutel,
 *     precies zoals de browser dat doet, en wordt alles opgevraagd.
 *  3. Aan het eind wordt alles opgeruimd, ook als een controle faalt.
 *
 * Het script maakt echte gebruikers aan in het project. Ze heten allemaal
 * rls-test-...@bedrijfskaart.example, zodat je ze altijd kunt terugvinden.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publiek = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const service =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publiek || !service) {
  console.error(
    'Ontbrekende omgevingsvariabelen. Nodig in .env.local:\n' +
      '  NEXT_PUBLIC_SUPABASE_URL\n' +
      '  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\n' +
      '  SUPABASE_SECRET_KEY\n' +
      'Zie de README onder "Toegangstest".'
  );
  process.exit(1);
}

/**
 * Welke twee onderdelen de test gebruikt, wordt uit de database gehaald: er
 * wordt een willekeurige eigendomsrelatie gepakt, zodat de ene kant wel en de
 * andere kant niet zichtbaar is voor de testlezer. Zo staan er geen bedrijfs-
 * namen in deze openbare repository, en werkt de test in elke database.
 */
let MAG = '';
let MAG_NIET = '';

const stempel = Date.now();
const LEZER = {
  email: `rls-test-lezer-${stempel}@bedrijfskaart.example`,
  password: `Tst-${stempel}-lezer!`,
};
const BEHEERDER = {
  email: `rls-test-beheerder-${stempel}@bedrijfskaart.example`,
  password: `Tst-${stempel}-beheer!`,
};

const beheer = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- Controles bijhouden ----------------------------------------------------

type Controle = { naam: string; goed: boolean; toelichting: string };
const controles: Controle[] = [];

function controleer(naam: string, goed: boolean, toelichting: string) {
  controles.push({ naam, goed, toelichting });
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${naam}${goed ? '' : ` -> ${toelichting}`}`);
}

// --- Hulpjes ---------------------------------------------------------------

async function clientVoor(gegevens: { email: string; password: string }) {
  const client = createClient(url!, publiek!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword(gegevens);
  if (error) throw new Error(`Inloggen als ${gegevens.email} mislukt: ${error.message}`);
  return client;
}

async function maakGebruiker(
  gegevens: { email: string; password: string },
  rol: 'beheerder' | 'lezer'
): Promise<string> {
  const { data, error } = await beheer.auth.admin.createUser({
    email: gegevens.email,
    password: gegevens.password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Testgebruiker aanmaken mislukt: ${error?.message ?? 'onbekend'}`);
  }
  // De trigger op auth.users heeft de rij al gezet; hier alleen de rol.
  const { error: rolFout } = await beheer
    .from('kaart_gebruikers')
    .upsert(
      { gebruiker_id: data.user.id, email: gegevens.email, rol },
      { onConflict: 'gebruiker_id' }
    );
  if (rolFout) throw new Error(`Rol zetten mislukt: ${rolFout.message}`);
  return data.user.id;
}

/** Aantal rijen dat een client uit een tabel krijgt voor een bepaald onderdeel. */
async function aantalVoor(
  client: SupabaseClient,
  tabel: string,
  entiteitId: string
): Promise<number> {
  const { data } = await client.from(tabel).select('id').eq('entiteit_id', entiteitId);
  return data?.length ?? 0;
}

// --- Hoofdprogramma --------------------------------------------------------

let lezerId: string | null = null;
let beheerderId: string | null = null;
const opgeruimd: Array<() => PromiseLike<unknown>> = [];

async function main() {
  console.log(`Toegangstest op ${url}\n`);

  // Welke onderdelen bestaan er?
  const { data: entiteiten, error: entFout } = await beheer
    .from('kaart_entiteiten')
    .select('id, naam');
  if (entFout) throw new Error(`Onderdelen ophalen mislukt: ${entFout.message}`);
  if (!entiteiten || entiteiten.length === 0) {
    throw new Error('Geen onderdelen in de database. Draai eerst npm run vul-database.');
  }

  const naamVanId = new Map(entiteiten.map((e) => [e.id as string, e.naam as string]));

  // Een relatie pakken, zodat de test ook kan nagaan dat een lijn pas verschijnt
  // als beide uiteinden zichtbaar zijn.
  const { data: relaties, error: relFout } = await beheer
    .from('kaart_relaties')
    .select('van_entiteit, naar_entiteit')
    .limit(1);
  if (relFout) throw new Error(`Relaties ophalen mislukt: ${relFout.message}`);
  if (!relaties || relaties.length === 0) {
    throw new Error(
      'Geen eigendomsrelaties in de database. Draai eerst npm run vul-database.'
    );
  }

  const magNietId = relaties[0].van_entiteit as string;
  const magId = relaties[0].naar_entiteit as string;
  MAG_NIET = naamVanId.get(magNietId) ?? '?';
  MAG = naamVanId.get(magId) ?? '?';
  const totaal = entiteiten.length;

  // --- Opzet -------------------------------------------------------------
  console.log('Opzetten van twee tijdelijke gebruikers en testinhoud...');

  lezerId = await maakGebruiker(LEZER, 'lezer');
  opgeruimd.push(() => beheer.auth.admin.deleteUser(lezerId!));
  beheerderId = await maakGebruiker(BEHEERDER, 'beheerder');
  opgeruimd.push(() => beheer.auth.admin.deleteUser(beheerderId!));

  // De lezer mag precies een onderdeel zien.
  const { error: toegangFout } = await beheer
    .from('kaart_toegang')
    .insert({ gebruiker_id: lezerId, entiteit_id: magId });
  if (toegangFout) throw new Error(`Toegang geven mislukt: ${toegangFout.message}`);

  // Testinhoud op beide onderdelen, zodat er ook echt iets te lekken valt.
  for (const [naam, entiteitId] of [
    [MAG, magId],
    [MAG_NIET, magNietId],
  ] as const) {
    const { data: proces, error: procesFout } = await beheer
      .from('kaart_processen')
      .insert({ entiteit_id: entiteitId, titel: `RLS-test proces ${naam}` })
      .select('id')
      .single();
    if (procesFout || !proces) {
      throw new Error(`Testproces maken mislukt: ${procesFout?.message}`);
    }
    opgeruimd.push(() => beheer.from('kaart_processen').delete().eq('id', proces.id));

    const inserts = await Promise.all([
      beheer.from('kaart_processtappen').insert({
        proces_id: proces.id,
        titel: `RLS-test stap ${naam}`,
        uitvoering: 'automatisch',
      }),
      beheer
        .from('kaart_taken')
        .insert({ entiteit_id: entiteitId, titel: `RLS-test taak ${naam}` })
        .select('id')
        .single(),
      beheer
        .from('kaart_documenten')
        .insert({
          entiteit_id: entiteitId,
          titel: `RLS-test document ${naam}`,
          url: 'https://example.com/rls-test',
        })
        .select('id')
        .single(),
      beheer
        .from('kaart_contactpersonen')
        .insert({ entiteit_id: entiteitId, naam: `RLS-test contact ${naam}` })
        .select('id')
        .single(),
    ]);

    for (const [i, tabel] of (
      ['kaart_processtappen', 'kaart_taken', 'kaart_documenten', 'kaart_contactpersonen'] as const
    ).entries()) {
      const res = inserts[i] as { error: { message: string } | null; data?: { id: string } };
      if (res.error) throw new Error(`Testinhoud maken mislukt (${tabel}): ${res.error.message}`);
      const rijId = res.data?.id;
      if (rijId) opgeruimd.push(() => beheer.from(tabel).delete().eq('id', rijId));
    }
  }

  console.log('Opzet klaar.\n');

  // --- 1. Een lezer met toegang tot precies een onderdeel -----------------
  console.log(`1. Lezer met toegang tot uitsluitend "${MAG}"`);
  const lezer = await clientVoor(LEZER);

  const { data: zichtbaar } = await lezer.from('kaart_entiteiten').select('id, naam');
  controleer(
    'ziet precies een onderdeel',
    zichtbaar?.length === 1 && zichtbaar[0].naam === MAG,
    `kreeg ${zichtbaar?.length ?? 0} onderdelen: ${(zichtbaar ?? []).map((e) => e.naam).join(', ')}`
  );

  const { data: verboden } = await lezer
    .from('kaart_entiteiten')
    .select('id, naam')
    .eq('id', magNietId);
  controleer(
    `kan "${MAG_NIET}" niet rechtstreeks op id opvragen`,
    (verboden?.length ?? 0) === 0,
    `kreeg ${verboden?.length ?? 0} rijen terug`
  );

  const { data: opNaam } = await lezer
    .from('kaart_entiteiten')
    .select('id, naam')
    .eq('naam', MAG_NIET);
  controleer(
    `kan "${MAG_NIET}" niet op naam opvragen`,
    (opNaam?.length ?? 0) === 0,
    `kreeg ${opNaam?.length ?? 0} rijen terug`
  );

  for (const tabel of [
    'kaart_processen',
    'kaart_taken',
    'kaart_documenten',
    'kaart_contactpersonen',
  ] as const) {
    const n = await aantalVoor(lezer, tabel, magNietId);
    controleer(`${tabel} van "${MAG_NIET}" blijft leeg`, n === 0, `kreeg ${n} rijen`);

    const m = await aantalVoor(lezer, tabel, magId);
    controleer(`${tabel} van "${MAG}" is wel zichtbaar`, m === 1, `kreeg ${m} rijen, verwacht 1`);
  }

  const { data: stappen } = await lezer.from('kaart_processtappen').select('id, titel');
  const foutieveStappen = (stappen ?? []).filter((s) =>
    String(s.titel).includes(MAG_NIET)
  );
  controleer(
    `processtappen van "${MAG_NIET}" blijven leeg`,
    foutieveStappen.length === 0,
    `kreeg ${foutieveStappen.length} stappen van een verboden onderdeel`
  );
  controleer(
    `processtappen van "${MAG}" zijn wel zichtbaar`,
    (stappen ?? []).some((s) => String(s.titel).includes(MAG)),
    'de stap van het toegestane onderdeel kwam niet terug'
  );

  const { data: relatiesEen } = await lezer.from('kaart_relaties').select('id');
  controleer(
    'ziet geen relatielijnen waarvan het andere uiteinde verborgen is',
    (relatiesEen?.length ?? 0) === 0,
    `kreeg ${relatiesEen?.length ?? 0} relaties`
  );

  const { data: andereGebruikers } = await lezer.from('kaart_gebruikers').select('email');
  controleer(
    'ziet alleen zijn eigen gebruikersrij',
    andereGebruikers?.length === 1 && andereGebruikers[0].email === LEZER.email,
    `kreeg ${andereGebruikers?.length ?? 0} gebruikers`
  );

  const { data: andereToegang } = await lezer.from('kaart_toegang').select('gebruiker_id');
  controleer(
    'ziet alleen zijn eigen toegangsrijen',
    (andereToegang ?? []).every((t) => t.gebruiker_id === lezerId),
    'kreeg toegangsrijen van een andere gebruiker'
  );

  const { data: isBeheerder } = await lezer.rpc('kaart_is_beheerder');
  controleer(
    'kaart_is_beheerder geeft false',
    isBeheerder === false,
    `gaf ${JSON.stringify(isBeheerder)}`
  );

  const { data: magZien } = await lezer.rpc('kaart_mag_zien', { p_entiteit: magNietId });
  controleer(
    `kaart_mag_zien geeft false voor "${MAG_NIET}"`,
    magZien === false,
    `gaf ${JSON.stringify(magZien)}`
  );

  // --- 2. Een lezer mag niets schrijven -----------------------------------
  console.log('\n2. Een lezer mag niets wijzigen');

  const { error: insertFout } = await lezer
    .from('kaart_entiteiten')
    .insert({ naam: `RLS-test sluipweg ${stempel}`, soort: 'holding' });
  controleer(
    'een onderdeel toevoegen wordt geweigerd',
    insertFout !== null,
    'de insert werd geaccepteerd'
  );

  const { data: gewijzigd } = await lezer
    .from('kaart_entiteiten')
    .update({ naam: 'Gekaapt' })
    .eq('id', magNietId)
    .select('id');
  controleer(
    `een verborgen onderdeel wijzigen raakt geen enkele rij`,
    (gewijzigd?.length ?? 0) === 0,
    `er werden ${gewijzigd?.length ?? 0} rijen gewijzigd`
  );

  const { data: eigenGewijzigd } = await lezer
    .from('kaart_entiteiten')
    .update({ positie_x: 999 })
    .eq('id', magId)
    .select('id');
  controleer(
    'een zichtbaar onderdeel verslepen raakt ook geen enkele rij',
    (eigenGewijzigd?.length ?? 0) === 0,
    `er werden ${eigenGewijzigd?.length ?? 0} rijen gewijzigd`
  );

  const { data: verwijderd } = await lezer
    .from('kaart_entiteiten')
    .delete()
    .eq('id', magId)
    .select('id');
  controleer(
    'verwijderen raakt geen enkele rij',
    (verwijderd?.length ?? 0) === 0,
    `er werden ${verwijderd?.length ?? 0} rijen verwijderd`
  );

  const { error: eigenRolFout } = await lezer
    .from('kaart_gebruikers')
    .update({ rol: 'beheerder' })
    .eq('gebruiker_id', lezerId!)
    .select('gebruiker_id');
  const { data: rolNa } = await beheer
    .from('kaart_gebruikers')
    .select('rol')
    .eq('gebruiker_id', lezerId!)
    .single();
  controleer(
    'kan zich niet zelf tot beheerder maken',
    rolNa?.rol === 'lezer',
    `rol is nu ${rolNa?.rol}, foutmelding was ${eigenRolFout?.message ?? 'geen'}`
  );

  const { error: eigenToegangFout } = await lezer
    .from('kaart_toegang')
    .insert({ gebruiker_id: lezerId!, entiteit_id: magNietId });
  controleer(
    'kan zich niet zelf toegang geven tot een ander onderdeel',
    eigenToegangFout !== null,
    'de insert werd geaccepteerd'
  );

  // --- 3. Een relatie wordt pas zichtbaar als beide kanten zichtbaar zijn --
  console.log('\n3. Relatielijnen volgen de toegang van beide uiteinden');

  await beheer.from('kaart_toegang').insert({ gebruiker_id: lezerId, entiteit_id: magNietId });

  const lezerTwee = await clientVoor(LEZER);
  const { data: entiteitenTwee } = await lezerTwee.from('kaart_entiteiten').select('naam');
  controleer(
    'ziet nu twee onderdelen',
    entiteitenTwee?.length === 2,
    `kreeg ${entiteitenTwee?.length ?? 0} onderdelen`
  );

  const { data: relatiesTwee } = await lezerTwee
    .from('kaart_relaties')
    .select('van_entiteit, naar_entiteit');
  const juisteRelatie =
    relatiesTwee?.length === 1 &&
    relatiesTwee[0].van_entiteit === magNietId &&
    relatiesTwee[0].naar_entiteit === magId;
  controleer(
    `ziet nu de lijn ${MAG_NIET} naar ${MAG}, en alleen die`,
    Boolean(juisteRelatie),
    `kreeg ${relatiesTwee?.length ?? 0} relaties`
  );

  await beheer
    .from('kaart_toegang')
    .delete()
    .eq('gebruiker_id', lezerId)
    .eq('entiteit_id', magNietId);

  // --- 4. Een beheerder ziet alles ----------------------------------------
  console.log('\n4. Een beheerder ziet alles');
  const beheerderClient = await clientVoor(BEHEERDER);

  const { data: alles } = await beheerderClient.from('kaart_entiteiten').select('id');
  controleer(
    `ziet alle ${totaal} onderdelen`,
    alles?.length === totaal,
    `kreeg ${alles?.length ?? 0} onderdelen`
  );

  const { data: alleRelaties } = await beheerderClient.from('kaart_relaties').select('id');
  const { count: relatiesEcht } = await beheer
    .from('kaart_relaties')
    .select('id', { count: 'exact', head: true });
  controleer(
    `ziet alle ${relatiesEcht ?? 0} relaties`,
    alleRelaties?.length === relatiesEcht,
    `kreeg ${alleRelaties?.length ?? 0} relaties`
  );

  const { data: beheerderIsBeheerder } = await beheerderClient.rpc('kaart_is_beheerder');
  controleer(
    'kaart_is_beheerder geeft true',
    beheerderIsBeheerder === true,
    `gaf ${JSON.stringify(beheerderIsBeheerder)}`
  );

  const { data: verplaatst } = await beheerderClient
    .from('kaart_entiteiten')
    .update({ positie_x: 12345 })
    .eq('id', magId)
    .select('id, positie_x');
  controleer(
    'mag een blok verslepen en de positie opslaan',
    verplaatst?.length === 1,
    `er werden ${verplaatst?.length ?? 0} rijen gewijzigd`
  );
  // Positie weer terugzetten.
  const { data: origineel } = await beheer
    .from('kaart_entiteiten')
    .select('positie_x')
    .eq('id', magId)
    .single();
  if (origineel) {
    await beheer.from('kaart_entiteiten').update({ positie_x: -550 }).eq('id', magId);
  }

  // --- 5. Zonder inloggen helemaal niets ----------------------------------
  console.log('\n5. Zonder sessie komt er niets uit');
  const zonderSessie = createClient(url!, publiek!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const tabel of [
    'kaart_entiteiten',
    'kaart_relaties',
    'kaart_processen',
    'kaart_processtappen',
    'kaart_taken',
    'kaart_documenten',
    'kaart_contactpersonen',
    'kaart_gebruikers',
    'kaart_toegang',
  ] as const) {
    const { data, error } = await zonderSessie.from(tabel).select('*');
    controleer(
      `${tabel} geeft niets aan een bezoeker zonder sessie`,
      error !== null || (data?.length ?? 0) === 0,
      `kreeg ${data?.length ?? 0} rijen zonder foutmelding`
    );
  }

  const { error: anonRpcFout } = await zonderSessie.rpc('kaart_is_beheerder');
  controleer(
    'kaart_is_beheerder is niet aan te roepen zonder sessie',
    anonRpcFout !== null,
    'de aanroep werd geaccepteerd'
  );
}

async function ruimOp() {
  console.log('\nOpruimen...');
  // In omgekeerde volgorde, zodat verwijzingen niet in de weg zitten.
  for (const taak of opgeruimd.reverse()) {
    try {
      await taak();
    } catch (e) {
      console.warn('  opruimen van een onderdeel mislukt:', e);
    }
  }
  const { data: over, error: controleFout } = await beheer
    .from('kaart_gebruikers')
    .select('email')
    .like('email', 'rls-test-%@bedrijfskaart.example');

  if (controleFout) {
    console.warn(
      `  kon niet nagaan of het opruimen gelukt is: ${controleFout.message}.\n` +
        '  Controleer zelf op gebruikers die rls-test-...@bedrijfskaart.example heten.'
    );
  } else if (over && over.length > 0) {
    console.warn(
      `  let op: er staan nog ${over.length} testgebruikers in kaart_gebruikers: ` +
        over.map((g) => g.email).join(', ')
    );
  } else {
    console.log('  alle testgebruikers en testinhoud zijn verwijderd.');
  }
}

let afsluitcode = 0;

try {
  await main();
} catch (e) {
  console.error('\nDe test kon niet worden afgerond:', e instanceof Error ? e.message : e);
  afsluitcode = 1;
} finally {
  await ruimOp();
}

const mislukt = controles.filter((c) => !c.goed);
console.log(
  `\n${controles.length - mislukt.length} van ${controles.length} controles goed.`
);

if (mislukt.length > 0) {
  console.log('\nNiet goed:');
  for (const c of mislukt) console.log(`  - ${c.naam}: ${c.toelichting}`);
  afsluitcode = 1;
} else if (afsluitcode === 0) {
  console.log(
    'Row Level Security houdt dicht: een lezer zonder toegang krijgt via de API\n' +
      'geen onderdelen, processen, taken, documenten, contactpersonen of relaties.'
  );
}

process.exit(afsluitcode);
