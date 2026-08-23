# Sprint 1 – UI för Ny jaktdag → Välj hund → Timer

Packa upp zip-filen rakt in i rot-mappen för `Skade`-repot (samma mappstruktur,
skriv över befintliga filer när det frågar). Inga nya npm-paket krävs – bara
`npm install` om du inte redan kört det.

## Nya filer

- `.eslintrc.js` – repot hade `eslint`/`eslint-config-expo` som beroende men
  ingen konfiguration, så `npm run lint` gick inte att köra alls. Minimal
  `extends: "expo"`-config så lint-scriptet faktiskt fungerar. Inte relaterat
  till UI-arbetet i sig, men upptäcktes under verifieringen.
- `src/db/queries/profil.ts` – `hamtaEllerSkapaProfil()` + `uppdateraProfilNamn()`.
  Appen har bara en profil per installation; den skapas automatiskt med tomt
  namn första gången, och tomt namn är signalen som styr onboarding-gaten.
- `src/screens/OnboardingScreen.tsx` – tvingande första-körning-skärm: eget
  namn + första hundens namn, innan resten av appen blir tillgänglig.
- `src/contexts/ProfilContext.tsx` – `useProfil()`-hook, ger alla skärmar
  under Stack:en åtkomst till profilId utan prop-drilling.
- `src/theme/colors.ts` – ljus/mörk färgpalett (hög kontrast för dåligt ljus).
- `src/hooks/useElapsedTime.ts` – tickande sekundräknare för timer-skärmen +
  `formateraTid()`.
- `src/components/BigButton.tsx`, `DateField.tsx`, `SelectableCard.tsx`,
  `TimerDisplay.tsx`, `InlineBanner.tsx`, `ScreenHeader.tsx` – delade
  UI-byggstenar, se motivering i respektive fils kommentarer.
- `app/hund/ny.tsx` – lägg till (ytterligare) hund, länkas från
  "Välj hund"-listan. Tar valfri `?jaktdagId=`-query-param för att navigera
  tillbaka dit efter spara.

## Ändrade filer

- `app/_layout.tsx` – bootstrap:ar profilen efter databas-init, renderar
  `OnboardingScreen` istället för `<Stack/>` så länge profilnamnet är tomt.
- `app/index.tsx` – minimal huvudskärm: hälsning + "Ny jaktdag"-knapp. Full
  hundlista/statistik på huvudskärmen är inte del av detta scope.
- `app/jaktdag/ny.tsx` – datum (chips + stegare, inget tangentbord) +
  jaktmark, sparar via `skapaJaktdag()`.
- `app/jaktdag/[jaktdagId]/valj-hund.tsx` – hundlista med flerval, extra
  "vilken hund drevar just nu"-steg om fler än en vald, `laggTillHundIJaktdag()`
  + `settAktivHund()`.
- `app/jaktdag/[jaktdagId]/timer.tsx` – robust start/stopp via
  `startaDrev()`/`stoppaDrev()`, återställer pågående drev från databasen vid
  mount, byt-aktiv-hund om flera hundar valdes, avsluta jaktdag-knapp.
- `src/db/queries/hund.ts` – två nya funktioner tillagda i slutet:
  `hamtaHund()` (hämta en hund via id, för namnvisning på timer-skärmen) och
  `hamtaHundarForJaktdag()` (hundarna kopplade till en specifik jaktdag, för
  byt-hund-funktionen). Inget befintligt ändrat.

## Verifierat innan leverans

- `npx tsc --noEmit` – 0 fel.
- `npx eslint . --ext .ts,.tsx` (med den nya `.eslintrc.js`) – 0 fel.
- `npx expo export --platform ios` – bundlade rent, 1002 moduler, ingen
  bundlingsfel.
- `npx expo export --platform web` gav ett fel, men det beror på att
  `react-dom` saknas som beroende i det ursprungliga scaffoldet (inte
  relaterat till den här sprinten) – appens mål är iOS App Store så det
  blockerar inget. Kör `npx expo install react-dom` om du vill kunna
  förhandsgranska i webbläsaren också.

## Kända avgränsningar i denna leverans

- Huvudskärmens riktiga hundlista/statistik är inte byggd - bara en
  navigationsentré till "Ny jaktdag", enligt scope-avgränsningen ni satte i
  förra chatten.
- Ingen bekräftelsedialog innan "Stoppa drev" - snabbhet prioriterades enligt
  UX-principerna. Säg till om ni vill ha ett skydd mot fingerfel här.
