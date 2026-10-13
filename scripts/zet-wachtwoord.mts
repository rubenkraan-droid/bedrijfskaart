/**
 * Zet een wachtwoord voor een bestaand account, of maakt het account aan als het
 * nog niet bestaat.
 *
 * Draaien:  npm run zet-wachtwoord
 *
 * Bedoeld voor de allereerste beheerder, als er nog niemand is die het
 * beheerscherm kan openen. Daarna gaat het eenvoudiger via
 * Beheer > Gebruikers en toegang.
 *
 * Het wachtwoord wordt in je eigen terminal gevraagd en niet meegetypt op het
 * scherm. Het staat dus niet in je shell-geschiedenis.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { vraagStil } from './vraag-stil.mts';

config({ path: '.env.local', quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !service) {
  console.error(
    'Ontbrekende omgevingsvariabelen. Nodig in .env.local:\n' +
      '  NEXT_PUBLIC_SUPABASE_URL\n' +
      '  SUPABASE_SECRET_KEY\n' +
      'Zie de README onder "De eerste beheerder aanmaken".'
  );
  process.exit(1);
}

const beheer = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const lezer = createInterface({ input: stdin, output: stdout });
  const email = (await lezer.question('E-mailadres: ')).trim().toLowerCase();
  lezer.close();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Dat is geen geldig e-mailadres.');
  }

  const wachtwoord = await vraagStil('Nieuw wachtwoord (wordt niet getoond): ');
  if (wachtwoord.length < 10) {
    throw new Error('Kies een wachtwoord van minstens 10 tekens.');
  }
  const herhaal = await vraagStil('Nog een keer: ');
  if (wachtwoord !== herhaal) {
    throw new Error('De twee wachtwoorden zijn niet gelijk.');
  }

  // Bestaat het account al?
  const { data: lijst, error: zoekFout } = await beheer.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (zoekFout) throw new Error(`Gebruikers ophalen mislukt: ${zoekFout.message}`);

  const bestaand = lijst.users.find((u) => u.email?.toLowerCase() === email);

  let gebruikerId: string;
  if (bestaand) {
    const { error } = await beheer.auth.admin.updateUserById(bestaand.id, {
      password: wachtwoord,
    });
    if (error) throw new Error(`Wachtwoord zetten mislukt: ${error.message}`);
    gebruikerId = bestaand.id;
    console.log(`\nWachtwoord gezet voor het bestaande account ${email}.`);
  } else {
    const { data, error } = await beheer.auth.admin.createUser({
      email,
      password: wachtwoord,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`Account aanmaken mislukt: ${error?.message ?? 'onbekend'}`);
    }
    gebruikerId = data.user.id;
    console.log(`\nAccount ${email} aangemaakt.`);
  }

  // Zorgen dat er een rij in kaart_gebruikers staat en dat die beheerder is.
  const { error: rolFout } = await beheer
    .from('kaart_gebruikers')
    .upsert(
      { gebruiker_id: gebruikerId, email, rol: 'beheerder' },
      { onConflict: 'gebruiker_id' }
    );
  if (rolFout) throw new Error(`Rol zetten mislukt: ${rolFout.message}`);

  console.log('Rol gezet op beheerder.');
  console.log('\nJe kunt nu inloggen op http://localhost:3000 met dit e-mailadres');
  console.log('en wachtwoord. Wijzig het daarna onder Mijn account.');
}

main().catch((fout) => {
  console.error('\nMislukt:', fout instanceof Error ? fout.message : fout);
  process.exit(1);
});
