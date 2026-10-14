# Bedrijfskaart

**https://kaart.recraparcs.nl**

Interne webtoepassing met een klikbare kaart van de bedrijfsstructuur. Per
onderdeel staan er uitleg, processen, taken, documenten en contactpersonen.
Iedereen logt in met e-mailadres en wachtwoord en ziet uitsluitend de onderdelen
waarvoor hij toegang heeft. Er komt geen e-mail aan te pas.

## Hoe het in elkaar zit

Dit is een **statische site**. Er draait geen server: GitHub Pages serveert
kant-en-klare bestanden, en de browser praat rechtstreeks met Supabase.

```
  browser  ──────────────►  Supabase (database)
     │                        Row Level Security bepaalt
     │                        wat iemand mag zien en wijzigen
     │
     └─────────────────────►  Supabase (edge function)
                              alleen voor accounts aanmaken
                              en wachtwoorden zetten
```

Dat dit veilig kan, zit hem helemaal in **Row Level Security**. De sleutel die in
de pagina staat (de publishable key) geeft op zichzelf nergens toegang toe. Pas
na inloggen bepaalt de database per rij wat die persoon mag zien. Wie geen
toegang heeft tot een onderdeel, krijgt dat ook niet als hij de API rechtstreeks
aanroept. Dat is nagegaan met `npm run test:rls`, zie verderop.

Twee dingen kunnen niet in de browser, omdat ze de geheime sleutel vragen: een
account aanmaken en een wachtwoord zetten. Die gaan via een edge function die bij
Supabase draait. Die controleert eerst of de aanvrager beheerder is en gebruikt
de geheime sleutel pas daarna; de sleutel verlaat Supabase nooit.

- Next.js (App Router) met `output: 'export'`, dus een map met HTML, CSS en JS
- React Flow voor de kaart
- Supabase voor de database, het inloggen en de edge function
- GitHub Pages voor het hosten, via `.github/workflows/pages.yml`

## Wat je nodig hebt

- Node 24 of nieuwer (`node -v`). De scripts draaien TypeScript rechtstreeks met
  `node --experimental-strip-types`.
- Toegang tot het Supabase-project `rubenkraan-droid's Project`
  (ref `ooqkpazyvohsrdvxfnug`, regio eu-central-1).

## Lokaal draaien

```bash
npm install
cp .env.example .env.local   # en vul de waarden in, zie hieronder
npm run dev
```

De toepassing draait dan op http://localhost:3000.

Wil je zien wat GitHub Pages straks serveert, bouw dan de echte site:

```bash
npm run build
npx serve out
```

### Omgevingsvariabelen

In `.env.local`:

| Variabele | Waar vind je die | Waarvoor |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-dashboard, Settings > API Keys | Alles |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | idem, onder **Publishable key** | Alles |
| `SUPABASE_SECRET_KEY` | idem, onder **Secret keys**, klik op het oogje. Begint met `sb_secret_` | Alleen de scripts: vullen, toegangstest, eerste beheerder |

De eerste twee zijn niet geheim: die staan ook in de gebouwde JavaScript en in de
workflow. Zo hoort dat bij Supabase.

De derde is dat wel. Die gaat buiten Row Level Security om en staat daarom
**nergens in deze repository**. Hij wordt alleen gebruikt door de scripts op je
eigen computer, en door de edge function, die hem van Supabase zelf krijgt.

> Supabase heeft zijn sleutels hernoemd. Wat vroeger `service_role` heette, heet
> nu een secret key. De oude lange JWT staat nog onder "Legacy anon, service_role
> API keys" en werkt ook; zet die dan onder dezelfde naam `SUPABASE_SECRET_KEY`.

## De database

### Migraties

De migraties in `supabase/migrations/` zijn al toegepast. Voor een nieuw project
of na een wijziging draai je ze met de Supabase CLI:

```bash
npx supabase link --project-ref ooqkpazyvohsrdvxfnug
npx supabase db push
```

Of met de hand: plak de bestanden op volgorde in de SQL-editor van het dashboard.

| Migratie | Wat erin zit |
| --- | --- |
| `20261008120000_kaart_schema.sql` | Tabellen, opsommingen, indexen, triggers |
| `20261008120100_kaart_rls.sql` | Row Level Security: hulpfuncties en policies |
| `20261008120200_kaart_functierechten.sql` | Rechten op de functies dichtzetten |
| `20261012120000_kaart_bestaande_gebruikers.sql` | Bestaande accounts een rij geven |

> **Let op:** dit project deelt het `public`-schema met het bestaande sales- en
> advertentiedashboard. Daarom heten alle tabellen en functies van deze
> toepassing `kaart_...`. De migraties raken geen enkele bestaande tabel aan. Ook
> `auth.users` is gedeeld: iemand met een account voor het dashboard kan dus
> inloggen, maar ziet zonder toegekende toegang een lege kaart.

### De edge function

```bash
npx supabase functions deploy beheer-gebruikers
```

Staat in `supabase/functions/beheer-gebruikers/` en is al uitgerold.

Wil je de toegang strakker zetten, geef de function dan de omgevingsvariabele
`KAART_HERKOMST` met de adressen waarvandaan de browser hem mag aanroepen:
`https://kaart.recraparcs.nl,http://localhost:3000`. Zonder die
variabele staat hij open voor elke herkomst; dat is niet erg, want hij weigert
toch iedereen die geen beheerder is.

### De database vullen

De structuur staat in `scripts/structuur.json`. **Dat bestand staat met opzet in
`.gitignore`**: deze repository is openbaar, en de namen van de bedrijven en de
aandeelhouders horen daar niet in. Zie `scripts/structuur.voorbeeld.json` voor de
opbouw.

```bash
npm run vul-database
```

Idempotent: bestaande onderdelen worden herkend op naam en met rust gelaten. Met
`npm run vul-database -- --overschrijf` zet je de omschrijvingen en de
beginposities wel terug naar wat er in het bestand staat.

Processen, taken, documenten en contactpersonen blijven leeg; die vul je via het
beheerscherm.

### De eerste beheerder aanmaken

Gebruikers toevoegen kan alleen een beheerder, en in het begin is er geen.
Daarvoor is er een script dat je een keer draait:

```bash
npm run zet-wachtwoord
```

Het vraagt om je e-mailadres en een wachtwoord. Wat je typt verschijnt niet op het
scherm en komt dus ook niet in je shell-geschiedenis. Bestaat het account al, dan
krijgt het alleen een nieuw wachtwoord; bestaat het nog niet, dan wordt het
aangemaakt. In beide gevallen wordt de rol op beheerder gezet.

Daarna voeg je iedereen toe via **Beheer > Gebruikers en toegang**.

## Toegangstest

Dit is de controle dat Row Level Security echt dichthoudt: kan een lezer zonder
toegang tot een onderdeel die gegevens alsnog via de API opvragen?

```bash
npm run test:rls
```

Het script maakt twee tijdelijke gebruikers aan, zet testinhoud op een onderdeel
dat de testlezer wel mag zien en op een dat hij niet mag zien, logt daarna in als
die lezer met de gewone publieke sleutel, en controleert onder meer:

- hij krijgt precies een onderdeel terug, en kan het verboden onderdeel ook niet
  rechtstreeks op id of op naam opvragen;
- processen, processtappen, taken, documenten en contactpersonen van het verboden
  onderdeel geven nul rijen, terwijl die van het toegestane onderdeel wel komen;
- hij ziet geen relatielijn waarvan het andere uiteinde verborgen is, en die lijn
  verschijnt pas zodra hij ook dat andere onderdeel mag zien;
- hij kan niets toevoegen, wijzigen of verwijderen, zichzelf geen beheerder maken
  en zichzelf geen extra toegang geven;
- een beheerder ziet wel alles en kan wel verslepen;
- zonder sessie komt er uit geen enkele tabel iets terug.

Aan het eind ruimt het script alles weer op, ook als een controle faalt.
Afsluitcode 1 bij een mislukking, met een overzicht van wat er misging.

Laatste uitslag: **40 van de 40 controles goed.**

## Hosten op GitHub Pages

De workflow `.github/workflows/pages.yml` bouwt de site bij elke push naar `main`
en zet hem op Pages. Dat staat ingesteld en werkt; je hoeft er niets meer aan te
doen. Voor de volledigheid, zo is het opgezet:

- **Settings > Pages**, bij **Source** staat **GitHub Actions**.
- Het eigen domein `kaart.recraparcs.nl` staat bij **Custom domain**, en in
  `public/CNAME` zodat het bij elke publicatie blijft staan. Bij Cloud86 wijst
  een CNAME-record `kaart` naar `rubenkraan-droid.github.io`.
- HTTPS wordt afgedwongen; GitHub vernieuwt het certificaat zelf.

Zou je ooit zonder eigen domein willen draaien, dan komt de site op
`rubenkraan-droid.github.io/bedrijfskaart/`. Zet dan onder **Settings > Secrets
and variables > Actions > Variables** een variabele `BASE_PATH` met de waarde
`/bedrijfskaart`, en haal `public/CNAME` weg.

> De repository is openbaar, want GitHub Pages vanuit een prive repository zit in
> een betaald abonnement. In de code staan geen geheimen en ook niet de echte
> bedrijfsstructuur: die staat in de database en in het genegeerde
> `scripts/structuur.json`.

## Hoe de toegang werkt

- **Beheerder** ziet en wijzigt alles.
- **Lezer** ziet uitsluitend de onderdelen die in `kaart_toegang` voor hem staan,
  met de processen, taken, documenten en contactpersonen daarvan.
- Een **relatielijn** is alleen zichtbaar als beide uiteinden zichtbaar zijn. Een
  lezer ziet dus nooit een lijn die verraadt dat er iets bestaat wat hij niet mag
  zien.
- Wie nieuw is in `auth.users` krijgt via een trigger automatisch de rol lezer
  zonder toegang: een lege kaart.

Zet in het Supabase-dashboard onder **Authentication > Sign In / Providers >
Email** de optie **Allow new users to sign up** uit. Anders kan iemand zichzelf
een account aanmaken. Die ziet dan nog steeds niets, maar het hoort dicht.

## Aandachtspunten

- **Geen e-mail.** De toepassing verstuurt niets. Je maakt iemand aan met een
  eerste wachtwoord en geeft dat zelf door. Diegene wijzigt het onder **Mijn
  account**. Kwijt? Dan zet een beheerder er een nieuw voor in de plaats bij
  **Beheer > Gebruikers en toegang > Wachtwoord opnieuw zetten**.
- **Gedeeld project.** Zie de waarschuwing bij de migraties hierboven.
- **npm audit** meldt waarschuwingen in `braces` en `micromatch`. Die zitten
  onder `eslint-config-next` en draaien alleen bij het linten, niet in de
  toepassing. `npm audit fix --force` zou de lintconfiguratie jaren terugzetten.

## Opbouw van de code

```
app/
  layout.tsx                      hoofdopmaak, huisstijl, wie is ingelogd
  globals.css                     kleuren, typografie, React Flow bijgesteld
  inloggen/                       e-mailadres en wachtwoord
  (app)/layout.tsx                houdt alles tegen zonder inlog
  (app)/page.tsx                  de kaart
  (app)/account/                  eigen gegevens en wachtwoord wijzigen
  (app)/beheer/                   beheerschermen
components/
  Werkblad.tsx                    kaart, zijpaneel en zoekbalk bij elkaar
  EntiteitNode.tsx                een blok op de kaart
  Zijpaneel.tsx                   de vijf tabbladen
  Zoekbalk.tsx                    zoeken in onderdelen en processen
  Kop.tsx                         de balk bovenaan
  beheer/                         formulierbouwstenen
lib/
  auth.tsx                        wie is ingelogd, en de bewaking per pagina
  acties.ts                       alle wijzigingen die het beheerscherm doet
  gegevens.ts                     ophalen met laadstand en foutmelding
  supabase/client.ts              de verbinding met de database
  types.ts                        types van de kaart_-tabellen
scripts/
  structuur.voorbeeld.json        voorbeeld van de beginstructuur
  vul-database.mts                vult de database daarmee
  test-rls.mts                    de toegangstest
  zet-wachtwoord.mts              eerste beheerder, draai je een keer
  vraag-stil.mts                  wachtwoord vragen zonder het te tonen
supabase/
  migrations/                     schema, RLS, functierechten
  functions/beheer-gebruikers/    accounts aanmaken en wachtwoorden zetten
```

## Handige commando's

```bash
npm run dev            # ontwikkelserver
npm run build          # bouwt de statische site naar out/
npm run typecheck      # alleen TypeScript
npm run lint           # ESLint
npm run vul-database   # beginstructuur in de database zetten
npm run test:rls       # toegangstest
npm run zet-wachtwoord # wachtwoord zetten voor de eerste beheerder
```
