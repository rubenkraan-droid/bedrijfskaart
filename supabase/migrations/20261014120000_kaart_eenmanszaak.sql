-- Bedrijfskaart: eenmanszaak als eigen soort
--
-- Een eenmanszaak is geen holding en geen besloten werkmaatschappij. Hij stond
-- eerst als holding op de kaart, wat niet klopt met hoe hij juridisch in elkaar
-- zit. Daarom een eigen soort, die op de kaart ook een eigen vorm krijgt.
--
-- De waarde komt direct na 'persoon' te staan, omdat een eenmanszaak qua
-- ordening tussen de persoon en de vennootschappen in hoort.

alter type public.kaart_soort add value if not exists 'eenmanszaak' after 'persoon';
