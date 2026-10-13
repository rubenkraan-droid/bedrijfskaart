-- Bedrijfskaart: rechten op de functies dichtzetten
--
-- kaart_nieuwe_gebruiker is een triggerfunctie met security definer. Hij hoort
-- alleen door de trigger op auth.users aangeroepen te worden, maar stond ook
-- als /rest/v1/rpc/kaart_nieuwe_gebruiker open voor anon en authenticated. Een
-- rechtstreekse aanroep zou mislukken omdat een triggerfunctie buiten een
-- trigger niet werkt, maar openstaan hoeft hij niet. De trigger zelf blijft
-- werken, want die draait met de rechten van de eigenaar van de functie.

revoke all on function public.kaart_nieuwe_gebruiker() from public, anon, authenticated;

-- kaart_is_beheerder en kaart_mag_zien blijven wel aanroepbaar voor
-- authenticated: de policies worden geevalueerd met de rechten van de
-- aanroepende rol, dus zonder dit recht werkt Row Level Security niet. Beide
-- geven alleen prijs wat de gebruiker toch al over zichzelf weet: zijn eigen rol,
-- en of hij een bepaald onderdeel mag zien. Voor een onbekend of verboden id
-- geven ze allebei false, dus er valt niets uit af te leiden.
