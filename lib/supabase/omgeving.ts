/**
 * Omgevingsvariabelen op een plek, met een duidelijke melding als er een mist.
 * De publieke waarden mogen in de browser komen, de service-role-sleutel niet.
 */

function vereist(naam: string, waarde: string | undefined): string {
  if (!waarde) {
    throw new Error(
      `Omgevingsvariabele ${naam} ontbreekt. Zet die in .env.local (lokaal) of in de ` +
        `omgevingsvariabelen van Vercel. Zie de README.`
    );
  }
  return waarde;
}

export function supabaseUrl(): string {
  return vereist('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabasePubliekeSleutel(): string {
  return vereist(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

/**
 * De geheime sleutel, uitsluitend op de server te gebruiken. Gaat buiten Row
 * Level Security om en mag nooit in een clientcomponent of in een antwoord
 * belanden.
 *
 * In het Supabase-dashboard heet dit tegenwoordig een "secret key"
 * (`sb_secret_...`). De oude naam was `service_role`, een lange JWT die nu onder
 * het tabblad "Legacy anon, service_role API keys" staat. Allebei werken, dus
 * allebei worden hier geaccepteerd.
 */
export function supabaseGeheimeSleutel(): string {
  return vereist(
    'SUPABASE_SECRET_KEY',
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
