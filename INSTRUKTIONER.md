# Hundhantering + viltart/utfall (Sprint 3, del 1)

Packa upp zip-filen rakt in i rot-mappen för `Skade`-repot (samma
mappstruktur, skriv över befintliga filer när det frågar). Inga nya
npm-paket krävs.

**Kom ihåg: kör appen minst en gång efter uppdateringen så att den nya
migrationen (0002) hinner köras** - den lägger till kolumnen `arkiverad`
på `Hund`. Migrationer körs automatiskt vid appstart (`runMigrations()`),
inget manuellt steg krävs utöver att starta om appen.

## Vad är nytt

- **Redigera hund**: tryck på en hund i huvudskärmens hundlista för att
  öppna en redigeringsskärm med Namn, Ras, Födelsedatum och Kommentar.
  Födelsedatum väljs med tre steppare (Dag/Månad/År) - inget
  kalenderbibliotek. "Spara ändringar" sparar direkt till databasen.
- **Arkivera hund**: tas bort från de vanliga listorna (syns inte längre
  när man ska välja hund för en ny jaktdag) men all historik finns kvar.
  Reversibelt när som helst via "Återställ hund". Nås även från en egen
  lista, "Visa arkiverade hundar", länkad längst ner på huvudskärmens
  hundlista.
- **Radera hund**: permanent, tar bort hundens drev och koppling till
  jaktdagar (jaktdagarna själva rörs inte).
- **Varningar bara när det finns data att förlora** (bestämt under
  arbetet): om hunden har historik (minst ett drev eller en koppling till
  en jaktdag) krävs en extra bekräftelse - en inline-varning som förklarar
  vad som händer, plus ett andra tryck - innan arkivering eller radering
  faktiskt sker. Har hunden ingen historik alls sker båda direkt vid
  knapptryck, utan extra steg. Att återställa en arkiverad hund
  ("Återställ hund") kräver aldrig någon bekräftelse - det är alltid
  ångerbart och stör ingenting.
- Både arkivering och radering är blockerade medan hunden har ett
  pågående drev (samma typ av spärr som redan fanns för att avsluta en
  jaktdag) - annars skulle den kunna försvinna ur listan mitt under en
  aktiv timer.
- **Viltart och utfall**: efter att ett drev stoppas visas nu två rader
  med snabbval (chips) - Viltart (Rådjur/Vildsvin/Räv/Hare/Älg) och
  Utfall (Fälld/Missad/Ingen kontakt), plus "Annat" med fritext för allt
  som inte är ett snabbval. Helt valfritt, blockerar inget - sparar direkt
  per tryck. Fälten hämtas tillbaka även om appen startas om innan man
  hinner fylla i dem (så länge inget nytt drev har startats).

## Nya filer

- `src/db/migrations/0002_hund_arkiverad.ts` (+ `.sql.reference`) - lägger
  till kolumnen `Hund.arkiverad` (0/1, standard 0).
- `src/components/ChipSelect.tsx` - återanvändbar chip-rad + fritext,
  används för viltart/utfall på timern.
- `src/components/BirthDateField.tsx` - tre-stegs datumväljare för
  födelsedatum (Dag/Månad/År), samma tryckbara-pil-mönster som `DateField`
  hade för jaktdagens datum i Sprint 1/2.
- `app/hund/[hundId].tsx` - redigera/arkivera/radera-skärmen.
- `app/hund/arkiverade.tsx` - lista över arkiverade hundar, varje rad
  öppnar samma redigeringsskärm.

## Ändrade filer

- `src/db/types.ts` - `Hund` har fått fältet `arkiverad: 0 | 1`.
- `src/db/migrate.ts` - registrerar migration 0002.
- `src/db/queries/hund.ts` - nya funktioner: `uppdateraHund()`,
  `arkiveraHund()`, `avarkiveraHund()`, `hamtaHundHarHistorik()`,
  `raderaHund()`, `hamtaArkiveradeHundar()`. Befintliga listfrågor
  (`hamtaHundarForProfil`, `hamtaHundarMedSenasteJaktdag`) filtrerar nu
  bort arkiverade hundar.
- `src/db/queries/drev.ts` - nya funktioner: `uppdateraDrevViltartUtfall()`
  och `hamtaPagaendeDrevForHund()` (skyddet mot att arkivera/radera en
  hund mitt i ett pågående drev).
- `src/components/InfoRow.tsx` - kan nu ta en valfri `onPress`-prop; blir
  då en tryckbar rad med en liten pil som hint, annars oförändrad.
- `app/index.tsx` - hundlistans rader är tryckbara (öppnar
  redigeringsskärmen), ny länk "Visa arkiverade hundar" under listan.
- `app/jaktdag/[jaktdagId]/timer.tsx` - viltart/utfall-chips efter stopp,
  skärmen är nu scrollbar (var fast tidigare) eftersom innehållet kan bli
  längre än skärmen med chipsen synliga.

## Verifierat innan leverans

- `npx tsc --noEmit` - 0 fel.
- `npx eslint . --ext .ts,.tsx` - 0 fel.
- `npx expo export --platform ios` - bundlade rent, 1008 moduler, ingen
  bundlingsfel.

## Kända avgränsningar

- Ingen sökning/filtrering i listan över arkiverade hundar - rimligt så
  länge antalet är litet, men säg till om det blir aktuellt.
- Viltart/utfall-chipsens alternativ (Rådjur/Vildsvin/... och
  Fälld/Missad/Ingen kontakt) är en rimlig startlista, inte konfigurerbar
  ännu - "Annat" täcker allt utanför listan tills vidare.
