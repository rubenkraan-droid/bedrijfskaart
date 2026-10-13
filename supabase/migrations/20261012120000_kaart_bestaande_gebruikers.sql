-- Bedrijfskaart: bestaande accounts een rij geven
--
-- De trigger kaart_nieuwe_gebruiker_trigger vult kaart_gebruikers bij elk nieuw
-- account in auth.users. auth.users is in dit project echter gedeeld met het
-- bestaande sales- en advertentiedashboard en bevatte dus al accounts voordat
-- deze toepassing bestond. Die kregen geen rij, met twee gevolgen:
--
--   1. Zij konden niet tot beheerder gemaakt worden, want er was niets om een
--      rol op te zetten.
--   2. Zij verschenen niet in het beheerscherm, dus een beheerder kon hun ook
--      geen toegang geven zonder hen opnieuw uit te nodigen, wat mislukt omdat
--      het account al bestaat.
--
-- Deze migratie haalt dat in. Iedereen krijgt de rol lezer zonder toegangsrijen,
-- en ziet dus een lege kaart totdat een beheerder onderdelen toekent. Er gaat
-- hiermee niemand iets zien wat hij nog niet mocht zien.

insert into public.kaart_gebruikers (gebruiker_id, email, naam)
select
  u.id,
  coalesce(u.email, ''),
  nullif(u.raw_user_meta_data ->> 'naam', '')
from auth.users u
on conflict (gebruiker_id) do nothing;
