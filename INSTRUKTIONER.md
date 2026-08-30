# Redigera hund och tid på ett drev

Packa upp zip-filen rakt in i rot-mappen för `Skade`-repot (samma
mappstruktur, skriv över befintliga filer). Ingen ny migration, inga nya
npm-paket.

## Vad är nytt

- **Vilken hund ett drev tillhör går nu att ändra i efterhand.** Öppnar
  man ett drev (från historiken, eller direkt efter ett stopp) och
  jaktdagen hade fler än en hund kopplad, visas en radiolista under
  "Hund" där man kan flytta drevet till en annan av dagens hundar. Har
  jaktdagen bara en hund visas namnet som vanlig text (inget att välja
  mellan).
- **Start- och sluttid går nu att ändra i efterhand**, under en ny
  "Tid"-sektion - var sitt Timme/Minut-val för Start och Slut. Duration
  räknas om live och visas längst upp på sidan. Spara-knappen stängs av
  (med ett varningsmeddelande) om vald sluttid inte längre är efter
  starttiden.
- Viltart och utfall fungerar precis som förut.

Det här gäller samma vy oavsett om man kommer hit direkt efter att ha
stoppat ett drev, eller öppnar ett äldre drev från historiken.

## Nya filer

- `src/components/TidField.tsx` - Timme/Minut-steppare för klockslaget på
  ett UnixTimestamp (datumet hålls fast). Samma delade `Stegare`-rad som
  övriga steppare i appen (BirthDateField/DatumField/PeriodFilter).
  Medvetet icke-carrying wraparound mellan timme och minut, för enkelhets
  skull.

## Ändrade filer

- `src/db/queries/drev.ts` - `uppdateraDrevViltartUtfall()` är borttagen
  och ersatt av `uppdateraDrev()`, som utöver viltart/utfall även kan
  ändra `hundId` och start-/sluttid (räknar om `duration` och kastar fel
  om sluttiden hamnar före starttiden).
- `app/jaktdag/[jaktdagId]/drev/[drevId].tsx` - ny Hund-sektion (radiolista
  när jaktdagen har fler än en hund) och ny Tid-sektion (två `TidField`,
  live duration, validering mot Spara-knappen).

## Verifierat innan leverans

`npx tsc --noEmit`, `npx eslint . --ext .ts,.tsx` och
`npx expo export --platform ios` - alla tre rena, 1018 moduler bundlade.

## Kända avgränsningar

- Ingen möjlighet att flytta ett drev till en hund som inte redan är
  kopplad till samma jaktdag (dvs. man kan inte lägga till en helt ny hund
  på jaktdagen från den här vyn - det görs fortfarande i "Välj hund"-
  steget). Säg till om det behövs.
- Tid-stepparna ändrar bara klockslaget, inte datumet - ett drev kan alltså
  inte flyttas till en annan dag från den här vyn.
