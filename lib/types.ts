/**
 * Types voor de tabellen van de bedrijfskaart.
 *
 * Het Supabase-project deelt het public-schema met het bestaande sales- en
 * advertentiedashboard. Een volledig gegenereerd typebestand zou daardoor
 * tienduizenden regels beslaan die hier niets doen, dus staat hier alleen het
 * deel dat deze toepassing gebruikt: de tabellen met het voorvoegsel kaart_.
 *
 * Blijft gelijk aan supabase/migrations/20261008120000_kaart_schema.sql. Pas je
 * daar iets aan, pas het dan hier ook aan.
 */

export type Rol = 'beheerder' | 'lezer';
export type Soort = 'persoon' | 'eenmanszaak' | 'holding' | 'werkmaatschappij';
export type Relatiesoort = 'eigenaar_van';
export type Uitvoering = 'automatisch' | 'handmatig';
export type Taakstatus = 'open' | 'bezig' | 'gereed' | 'geblokkeerd';

export type Gebruiker = {
  gebruiker_id: string;
  email: string;
  naam: string | null;
  rol: Rol;
  aangemaakt_op: string;
  bijgewerkt_op: string;
};

export type Entiteit = {
  id: string;
  naam: string;
  soort: Soort;
  korte_omschrijving: string | null;
  uitgebreide_omschrijving: string | null;
  positie_x: number;
  positie_y: number;
  aangemaakt_op: string;
  bijgewerkt_op: string;
};

export type Relatie = {
  id: string;
  van_entiteit: string;
  naar_entiteit: string;
  soort: Relatiesoort;
  aangemaakt_op: string;
  bijgewerkt_op: string;
};

export type Proces = {
  id: string;
  entiteit_id: string;
  titel: string;
  beschrijving: string | null;
  volgorde: number;
  aangemaakt_op: string;
  bijgewerkt_op: string;
};

export type Processtap = {
  id: string;
  proces_id: string;
  volgorde: number;
  titel: string;
  beschrijving: string | null;
  uitvoering: Uitvoering;
  toelichting: string | null;
  aangemaakt_op: string;
  bijgewerkt_op: string;
};

export type Taak = {
  id: string;
  entiteit_id: string;
  titel: string;
  verantwoordelijke: string | null;
  status: Taakstatus;
  deadline: string | null;
  aangemaakt_op: string;
  bijgewerkt_op: string;
};

export type Document = {
  id: string;
  entiteit_id: string;
  titel: string;
  url: string;
  aangemaakt_op: string;
  bijgewerkt_op: string;
};

export type Contactpersoon = {
  id: string;
  entiteit_id: string;
  naam: string;
  rol: string | null;
  email: string | null;
  telefoon: string | null;
  aangemaakt_op: string;
  bijgewerkt_op: string;
};

export type Toegang = {
  gebruiker_id: string;
  entiteit_id: string;
  aangemaakt_op: string;
};

/** Een proces met zijn stappen, zoals het zijpaneel het nodig heeft. */
export type ProcesMetStappen = Proces & { stappen: Processtap[] };

export const SOORT_LABEL: Record<Soort, string> = {
  persoon: 'Persoon',
  eenmanszaak: 'Eenmanszaak',
  holding: 'Holding',
  werkmaatschappij: 'Werkmaatschappij',
};

export const STATUS_LABEL: Record<Taakstatus, string> = {
  open: 'Open',
  bezig: 'Bezig',
  gereed: 'Gereed',
  geblokkeerd: 'Geblokkeerd',
};

export const UITVOERING_LABEL: Record<Uitvoering, string> = {
  automatisch: 'Automatisch',
  handmatig: 'Handmatig',
};
