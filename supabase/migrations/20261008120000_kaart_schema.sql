-- Bedrijfskaart: schema
--
-- Alle objecten van deze toepassing krijgen het voorvoegsel "kaart_", omdat dit
-- Supabase-project het public-schema deelt met het bestaande sales- en
-- advertentiedashboard. Er wordt niets aan bestaande tabellen gewijzigd.

-- ---------------------------------------------------------------------------
-- Opsommingen
-- ---------------------------------------------------------------------------

create type public.kaart_rol as enum ('beheerder', 'lezer');
create type public.kaart_soort as enum ('persoon', 'holding', 'werkmaatschappij');
create type public.kaart_relatiesoort as enum ('eigenaar_van');
create type public.kaart_uitvoering as enum ('automatisch', 'handmatig');
create type public.kaart_taakstatus as enum ('open', 'bezig', 'gereed', 'geblokkeerd');

-- ---------------------------------------------------------------------------
-- Hulpfunctie: bijgewerkt_op bijhouden
-- ---------------------------------------------------------------------------

create or replace function public.kaart_zet_bijgewerkt_op()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.bijgewerkt_op := now();
  return new;
end;
$$;

comment on function public.kaart_zet_bijgewerkt_op() is
  'Zet bijgewerkt_op op now() bij elke update. Gebruikt door alle kaart_-tabellen.';

-- ---------------------------------------------------------------------------
-- Gebruikers en rollen
-- ---------------------------------------------------------------------------

create table public.kaart_gebruikers (
  gebruiker_id  uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  naam          text,
  rol           public.kaart_rol not null default 'lezer',
  aangemaakt_op timestamptz not null default now(),
  bijgewerkt_op timestamptz not null default now()
);

comment on table public.kaart_gebruikers is
  'Rol per gebruiker van de bedrijfskaart. Nieuwe gebruikers zijn lezer zonder toegang.';

-- ---------------------------------------------------------------------------
-- Entiteiten en relaties
-- ---------------------------------------------------------------------------

create table public.kaart_entiteiten (
  id                       uuid primary key default gen_random_uuid(),
  naam                     text not null unique,
  soort                    public.kaart_soort not null,
  korte_omschrijving       text,
  uitgebreide_omschrijving text,
  positie_x                numeric not null default 0,
  positie_y                numeric not null default 0,
  aangemaakt_op            timestamptz not null default now(),
  bijgewerkt_op            timestamptz not null default now()
);

comment on column public.kaart_entiteiten.positie_x is
  'Positie op de kaart. Wordt bijgewerkt als een beheerder een blok versleept.';

create table public.kaart_relaties (
  id            uuid primary key default gen_random_uuid(),
  van_entiteit  uuid not null references public.kaart_entiteiten (id) on delete cascade,
  naar_entiteit uuid not null references public.kaart_entiteiten (id) on delete cascade,
  soort         public.kaart_relatiesoort not null default 'eigenaar_van',
  aangemaakt_op timestamptz not null default now(),
  bijgewerkt_op timestamptz not null default now(),
  constraint kaart_relaties_niet_naar_zichzelf check (van_entiteit <> naar_entiteit),
  constraint kaart_relaties_uniek unique (van_entiteit, naar_entiteit, soort)
);

comment on table public.kaart_relaties is
  'Eigendomsrelaties, gericht van eigenaar naar onderdeel. Zonder percentages.';

-- ---------------------------------------------------------------------------
-- Inhoud per entiteit
-- ---------------------------------------------------------------------------

create table public.kaart_processen (
  id            uuid primary key default gen_random_uuid(),
  entiteit_id   uuid not null references public.kaart_entiteiten (id) on delete cascade,
  titel         text not null,
  beschrijving  text,
  volgorde      integer not null default 0,
  aangemaakt_op timestamptz not null default now(),
  bijgewerkt_op timestamptz not null default now()
);

create table public.kaart_processtappen (
  id            uuid primary key default gen_random_uuid(),
  proces_id     uuid not null references public.kaart_processen (id) on delete cascade,
  volgorde      integer not null default 0,
  titel         text not null,
  beschrijving  text,
  uitvoering    public.kaart_uitvoering not null default 'handmatig',
  toelichting   text,
  aangemaakt_op timestamptz not null default now(),
  bijgewerkt_op timestamptz not null default now()
);

comment on column public.kaart_processtappen.uitvoering is
  'automatisch = koppeling of automatisering, handmatig = een medewerker doet dit.';
comment on column public.kaart_processtappen.toelichting is
  'Bij automatisch: welke koppeling. Bij handmatig: wie de stap uitvoert.';

create table public.kaart_taken (
  id                uuid primary key default gen_random_uuid(),
  entiteit_id       uuid not null references public.kaart_entiteiten (id) on delete cascade,
  titel             text not null,
  verantwoordelijke text,
  status            public.kaart_taakstatus not null default 'open',
  deadline          date,
  aangemaakt_op     timestamptz not null default now(),
  bijgewerkt_op     timestamptz not null default now()
);

create table public.kaart_documenten (
  id            uuid primary key default gen_random_uuid(),
  entiteit_id   uuid not null references public.kaart_entiteiten (id) on delete cascade,
  titel         text not null,
  url           text not null,
  aangemaakt_op timestamptz not null default now(),
  bijgewerkt_op timestamptz not null default now(),
  constraint kaart_documenten_url_is_link check (url ~* '^https?://')
);

create table public.kaart_contactpersonen (
  id            uuid primary key default gen_random_uuid(),
  entiteit_id   uuid not null references public.kaart_entiteiten (id) on delete cascade,
  naam          text not null,
  rol           text,
  email         text,
  telefoon      text,
  aangemaakt_op timestamptz not null default now(),
  bijgewerkt_op timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Toegang: welke lezer mag welke entiteit zien
-- ---------------------------------------------------------------------------

create table public.kaart_toegang (
  gebruiker_id  uuid not null references auth.users (id) on delete cascade,
  entiteit_id   uuid not null references public.kaart_entiteiten (id) on delete cascade,
  aangemaakt_op timestamptz not null default now(),
  primary key (gebruiker_id, entiteit_id)
);

comment on table public.kaart_toegang is
  'Koppeltabel. Een lezer ziet uitsluitend de entiteiten die hier voor hem staan. Beheerders zien alles.';

-- ---------------------------------------------------------------------------
-- Indexen
-- ---------------------------------------------------------------------------

create index kaart_relaties_van_idx          on public.kaart_relaties (van_entiteit);
create index kaart_relaties_naar_idx         on public.kaart_relaties (naar_entiteit);
create index kaart_processen_entiteit_idx    on public.kaart_processen (entiteit_id);
create index kaart_processtappen_proces_idx  on public.kaart_processtappen (proces_id);
create index kaart_taken_entiteit_idx        on public.kaart_taken (entiteit_id);
create index kaart_documenten_entiteit_idx   on public.kaart_documenten (entiteit_id);
create index kaart_contactpersonen_ent_idx   on public.kaart_contactpersonen (entiteit_id);
create index kaart_toegang_gebruiker_idx     on public.kaart_toegang (gebruiker_id);
create index kaart_toegang_entiteit_idx      on public.kaart_toegang (entiteit_id);

-- ---------------------------------------------------------------------------
-- bijgewerkt_op-triggers
-- ---------------------------------------------------------------------------

create trigger kaart_gebruikers_bijgewerkt
  before update on public.kaart_gebruikers
  for each row execute function public.kaart_zet_bijgewerkt_op();

create trigger kaart_entiteiten_bijgewerkt
  before update on public.kaart_entiteiten
  for each row execute function public.kaart_zet_bijgewerkt_op();

create trigger kaart_relaties_bijgewerkt
  before update on public.kaart_relaties
  for each row execute function public.kaart_zet_bijgewerkt_op();

create trigger kaart_processen_bijgewerkt
  before update on public.kaart_processen
  for each row execute function public.kaart_zet_bijgewerkt_op();

create trigger kaart_processtappen_bijgewerkt
  before update on public.kaart_processtappen
  for each row execute function public.kaart_zet_bijgewerkt_op();

create trigger kaart_taken_bijgewerkt
  before update on public.kaart_taken
  for each row execute function public.kaart_zet_bijgewerkt_op();

create trigger kaart_documenten_bijgewerkt
  before update on public.kaart_documenten
  for each row execute function public.kaart_zet_bijgewerkt_op();

create trigger kaart_contactpersonen_bijgewerkt
  before update on public.kaart_contactpersonen
  for each row execute function public.kaart_zet_bijgewerkt_op();

-- ---------------------------------------------------------------------------
-- Nieuwe gebruiker krijgt automatisch een rij, als lezer en zonder toegang
-- ---------------------------------------------------------------------------

create or replace function public.kaart_nieuwe_gebruiker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.kaart_gebruikers (gebruiker_id, email, naam)
    values (
      new.id,
      coalesce(new.email, ''),
      nullif(new.raw_user_meta_data ->> 'naam', '')
    )
    on conflict (gebruiker_id) do nothing;
  exception when others then
    -- auth.users wordt gedeeld met het bestaande dashboard. Het aanmelden van
    -- een gebruiker mag nooit stuklopen op deze toepassing.
    raise warning 'kaart_nieuwe_gebruiker faalde: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger kaart_nieuwe_gebruiker_trigger
  after insert on auth.users
  for each row execute function public.kaart_nieuwe_gebruiker();

-- ---------------------------------------------------------------------------
-- Rechten: anon krijgt niets, authenticated krijgt toegang via RLS
-- ---------------------------------------------------------------------------

revoke all on table
  public.kaart_gebruikers,
  public.kaart_entiteiten,
  public.kaart_relaties,
  public.kaart_processen,
  public.kaart_processtappen,
  public.kaart_taken,
  public.kaart_documenten,
  public.kaart_contactpersonen,
  public.kaart_toegang
from anon;

grant select, insert, update, delete on table
  public.kaart_gebruikers,
  public.kaart_entiteiten,
  public.kaart_relaties,
  public.kaart_processen,
  public.kaart_processtappen,
  public.kaart_taken,
  public.kaart_documenten,
  public.kaart_contactpersonen,
  public.kaart_toegang
to authenticated;
