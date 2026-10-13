-- Bedrijfskaart: Row Level Security
--
-- Uitgangspunt: dicht tenzij expliciet toegekend. Een lezer ziet uitsluitend de
-- entiteiten die in kaart_toegang voor hem staan, plus de inhoud daarvan. Een
-- beheerder ziet en wijzigt alles. anon ziet niets: die rol heeft geen rechten
-- op deze tabellen en ook geen enkele policy.
--
-- De twee hulpfuncties zijn security definer, zodat de policy op
-- kaart_gebruikers en kaart_toegang zichzelf niet opnieuw aanroept
-- (oneindige recursie). search_path staat vast tegen kaping.

-- ---------------------------------------------------------------------------
-- Hulpfuncties
-- ---------------------------------------------------------------------------

create or replace function public.kaart_is_beheerder()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kaart_gebruikers g
    where g.gebruiker_id = auth.uid()
      and g.rol = 'beheerder'
  );
$$;

comment on function public.kaart_is_beheerder() is
  'Waar als de ingelogde gebruiker de rol beheerder heeft.';

create or replace function public.kaart_mag_zien(p_entiteit uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.kaart_is_beheerder()
     or exists (
       select 1
       from public.kaart_toegang t
       where t.gebruiker_id = auth.uid()
         and t.entiteit_id = p_entiteit
     );
$$;

comment on function public.kaart_mag_zien(uuid) is
  'Waar als de ingelogde gebruiker deze entiteit mag zien: beheerder, of expliciete toegang.';

revoke all on function public.kaart_is_beheerder() from public, anon;
revoke all on function public.kaart_mag_zien(uuid) from public, anon;
grant execute on function public.kaart_is_beheerder() to authenticated;
grant execute on function public.kaart_mag_zien(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS aanzetten
-- ---------------------------------------------------------------------------

alter table public.kaart_gebruikers      enable row level security;
alter table public.kaart_entiteiten      enable row level security;
alter table public.kaart_relaties        enable row level security;
alter table public.kaart_processen       enable row level security;
alter table public.kaart_processtappen   enable row level security;
alter table public.kaart_taken           enable row level security;
alter table public.kaart_documenten      enable row level security;
alter table public.kaart_contactpersonen enable row level security;
alter table public.kaart_toegang         enable row level security;

-- ---------------------------------------------------------------------------
-- kaart_gebruikers: eigen rij lezen, beheerder alles
-- ---------------------------------------------------------------------------

create policy "gebruiker leest eigen rij of beheerder leest alles"
  on public.kaart_gebruikers for select to authenticated
  using (gebruiker_id = auth.uid() or (select public.kaart_is_beheerder()));

create policy "alleen beheerder wijzigt gebruikers"
  on public.kaart_gebruikers for all to authenticated
  using ((select public.kaart_is_beheerder()))
  with check ((select public.kaart_is_beheerder()));

-- ---------------------------------------------------------------------------
-- kaart_toegang: eigen rijen lezen, beheerder alles
-- ---------------------------------------------------------------------------

create policy "gebruiker leest eigen toegang of beheerder leest alles"
  on public.kaart_toegang for select to authenticated
  using (gebruiker_id = auth.uid() or (select public.kaart_is_beheerder()));

create policy "alleen beheerder wijzigt toegang"
  on public.kaart_toegang for all to authenticated
  using ((select public.kaart_is_beheerder()))
  with check ((select public.kaart_is_beheerder()));

-- ---------------------------------------------------------------------------
-- kaart_entiteiten
-- ---------------------------------------------------------------------------

create policy "lezen wat je mag zien"
  on public.kaart_entiteiten for select to authenticated
  using ((select public.kaart_mag_zien(id)));

create policy "alleen beheerder wijzigt entiteiten"
  on public.kaart_entiteiten for all to authenticated
  using ((select public.kaart_is_beheerder()))
  with check ((select public.kaart_is_beheerder()));

-- ---------------------------------------------------------------------------
-- kaart_relaties: alleen als beide uiteinden zichtbaar zijn
-- ---------------------------------------------------------------------------

create policy "lezen alleen als beide uiteinden zichtbaar zijn"
  on public.kaart_relaties for select to authenticated
  using (
    (select public.kaart_mag_zien(van_entiteit))
    and (select public.kaart_mag_zien(naar_entiteit))
  );

create policy "alleen beheerder wijzigt relaties"
  on public.kaart_relaties for all to authenticated
  using ((select public.kaart_is_beheerder()))
  with check ((select public.kaart_is_beheerder()));

-- ---------------------------------------------------------------------------
-- Inhoud per entiteit
-- ---------------------------------------------------------------------------

create policy "lezen via de entiteit"
  on public.kaart_processen for select to authenticated
  using ((select public.kaart_mag_zien(entiteit_id)));

create policy "alleen beheerder wijzigt processen"
  on public.kaart_processen for all to authenticated
  using ((select public.kaart_is_beheerder()))
  with check ((select public.kaart_is_beheerder()));

create policy "lezen via het proces en de entiteit"
  on public.kaart_processtappen for select to authenticated
  using (
    exists (
      select 1
      from public.kaart_processen p
      where p.id = proces_id
        and public.kaart_mag_zien(p.entiteit_id)
    )
  );

create policy "alleen beheerder wijzigt processtappen"
  on public.kaart_processtappen for all to authenticated
  using ((select public.kaart_is_beheerder()))
  with check ((select public.kaart_is_beheerder()));

create policy "lezen via de entiteit"
  on public.kaart_taken for select to authenticated
  using ((select public.kaart_mag_zien(entiteit_id)));

create policy "alleen beheerder wijzigt taken"
  on public.kaart_taken for all to authenticated
  using ((select public.kaart_is_beheerder()))
  with check ((select public.kaart_is_beheerder()));

create policy "lezen via de entiteit"
  on public.kaart_documenten for select to authenticated
  using ((select public.kaart_mag_zien(entiteit_id)));

create policy "alleen beheerder wijzigt documenten"
  on public.kaart_documenten for all to authenticated
  using ((select public.kaart_is_beheerder()))
  with check ((select public.kaart_is_beheerder()));

create policy "lezen via de entiteit"
  on public.kaart_contactpersonen for select to authenticated
  using ((select public.kaart_mag_zien(entiteit_id)));

create policy "alleen beheerder wijzigt contactpersonen"
  on public.kaart_contactpersonen for all to authenticated
  using ((select public.kaart_is_beheerder()))
  with check ((select public.kaart_is_beheerder()));
