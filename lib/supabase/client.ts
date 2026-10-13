'use client';

import { createBrowserClient } from '@supabase/ssr';
import { supabasePubliekeSleutel, supabaseUrl } from './omgeving';

/**
 * Supabase-client voor de browser. Gebruikt dezelfde sessie-cookies als de
 * server en werkt dus ook onder Row Level Security: een gebruiker kan hiermee
 * niets opvragen waar hij geen toegang toe heeft.
 */
let client: ReturnType<typeof createBrowserClient> | undefined;

export function supabaseBrowser() {
  client ??= createBrowserClient(supabaseUrl(), supabasePubliekeSleutel());
  return client;
}
