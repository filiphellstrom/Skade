# Sprint 2 – Riktig huvudskärm + bakåtnavigering

Packa upp rakt in i repo-roten, skriv över de befintliga filerna. Inga nya
npm-paket krävs.

## Nya filer

- `src/components/BackButton.tsx` – stor, fristående tillbaka-knapp.
  Komplement till (inte ersättning för) swipe-tillbaka-gesten - beslutat
  eftersom swipe är svårt att träffa precist med jakthandskar i kallt väder.
  Standardbeteende: ett steg bakåt om möjligt, annars till huvudskärmen.
- `src/components/InfoRow.tsx` – icke-tryckbar informationsrad, samma
  kortstil som `SelectableCard` men utan val-markör. Används för
  hundlistan och "pågående jaktdag"-sammanfattningen på huvudskärmen.

## Ändrade filer

- `app/index.tsx` – full ombyggnad. Två lägen: "Ny jaktdag"-knapp om ingen
  jaktdag pågår, annars ett "Fortsätt jaktdag"-kort (appen tillåter bara en
  pågående jaktdag åt gången - "Ny jaktdag" döljs så länge en redan pågår).
  "Fortsätt"-knappen routar till "Välj hund" eller direkt till timern
  beroende på om hundval redan slutförts. Under det: en hundlista med
  senaste jaktdag + total drevtid, samt en "+ Lägg till hund"-länk som nu
  är nåbar direkt från huvudskärmen (tidigare bara via "Välj hund").
- `src/db/queries/jaktdag.ts` – en ny funktion tillagd i slutet:
  `hamtaPagaendeJaktdag()` (hämtar profilens pågående jaktdag, om någon
  finns). Inget befintligt ändrat.
- `src/components/ScreenHeader.tsx` – ny valfri prop `visaTillbaka` som
  renderar `BackButton` ovanför jaktmark/datum.
- `app/jaktdag/[jaktdagId]/valj-hund.tsx` och `.../timer.tsx` – satt
  `visaTillbaka` på `ScreenHeader`-anropet.
- `app/jaktdag/ny.tsx` – lade till `BackButton` överst. **Samtidigt togs
  datumväljaren bort** (beslutat under sprinten: en jaktdag är alltid
  dagens datum, inget behov av att kunna välja ett annat). Jaktmark är nu
  enda fältet på skärmen. `DateField`-komponenten (från Sprint 1) används
  inte längre någonstans men ligger kvar i `src/components/` ifall den
  behövs igen, t.ex. för filtrering i en framtida historikvy.

## Hur "bakåt" faktiskt fungerar

Ingen ny navigeringslogik behövde byggas för själva flödet - `ny.tsx` →
`valj-hund.tsx` → `timer.tsx` har redan använt `router.replace()` mellan
varje steg sedan Sprint 1 (inte `push`), vilket gör att varje mellansteg
redan är borttaget ur historiken när man kommer vidare. Det betyder att en
vanlig `router.back()` från vilken skärm som helst i flödet landar direkt
på huvudskärmen - och eftersom jaktdagen redan är sparad i databasen
(sparar-direkt-principen sedan Sprint 1) tappas ingenting: huvudskärmens
"Fortsätt jaktdag"-kort tar en rätt tillbaka in i flödet igen, till rätt
steg.

## Verifierat innan leverans

- `npx tsc --noEmit` – 0 fel.
- `npx eslint . --ext .ts,.tsx` – 0 fel.
- `npx expo export --platform ios` – bundlade rent, 1003 moduler.

## Kända avgränsningar

- "Tillbaka" i jaktdags-flödet går alltid till huvudskärmen, inte ett steg
  åt gången till föregående delskärm (se förklaringen ovan för varför det
  ändå fungerar bra i praktiken). Säg till om ni hellre vill ha ett riktigt
  steg-för-steg-bakåt.
- Ingen "Avsluta jaktdag"-genväg på huvudskärmen än - man behöver gå in via
  "Fortsätt jaktdag" → Timer för att avsluta, precis som innan.
