# Skade – instruktioner för Claude Code

> Utvecklingen sker tills vidare i claude.ai-projektet "Skade", inte i Claude Code (beslut 2026-11-16). Filen finns kvar för den dag arbetet flyttar hit, troligen när Filip har en Mac.

Skade är en jaktdagbok för drivande hund: tidtagning av drev, historik, statistik, karta, och sedan november 2026 jaktlag med plan, eftersök och chatt. Ägare: Filip. Målet är en komplett app i App Store före sommaren 2027. Tills dess testas allt via TestFlight.

**Svara på svenska.** All text i appen är på svenska: versal bara först i meningen, inga utropstecken.

## Fasta regler
- **Repot är publikt.** Checka aldrig in hemligheter, riktiga GPX-filer (pass, åtlar, hund- och förarspår) eller personuppgifter. Testerna använder påhittade filer. Riktiga exporter kan ligga i `src/vind/__tests__/fixtures/privat/` och `src/spar/__tests__/fixtures/privat/` (gitignorerade).
- **Hemligheter** ligger som Worker-secrets hos Cloudflare. Filip lägger in dem själv. Be aldrig om dem i chatten.
- **Kostnader:** Filip ska godkänna allt som kan kosta pengar innan det görs. Allt ligger på gratisnivåer idag (Cloudflare, EAS, Google-inloggningen).
- **Bara det som delas i ett jaktlag ligger på servern.** Drev, hundar, jaktdagar och dokument stannar i telefonen.
- **Håll hjälpen aktuell:** `app/hjalp.tsx` beskriver hur appen faktiskt fungerar och ändras tillsammans med funktionen.

## Kod och struktur
- Expo SDK 54, expo-router, TypeScript. Lokal data i SQLite (`src/db`, migrationer numrerade).
- Plattformsfiler: `X.tsx` är iPhone, `X.web.tsx` är webben. Kartan är Apple Maps (`react-native-maps`) i appen och Leaflet på webben.
- `app/` skärmar, `src/components/` delar, `src/jaktlag/` jaktlagens lager och API-anrop, `src/konto/` inloggning, `targets/` och `modules/` Live Activity i Swift.
- `server/` är en egen Cloudflare Worker (`skade-api`, D1-databasen `skade`, Better Auth). Nya tabeller: en ny SQL-fil i `server/migrations/`, körs automatiskt före driftsättning.
- Namn i koden är på svenska utan å, ä, ö (`jaktdag`, `hamtaSpar`). Följ det.

## Filips dator
Windows med PowerShell. **Det går inte att bygga eller köra iOS-appen lokalt** (ingen Mac, ingen simulator). Det som bara finns i iPhone-appen provas i TestFlight på Filips telefon. Webben och servern körs lokalt. Skriv kommandon för PowerShell, inte bash (`$env:NAMN = "värde"`, `;` i stället för `&&` om det ska fungera i äldre PowerShell).

## Kommandon
```
npm run typecheck        # tsc
npm run lint             # eslint
npm test                 # beräkningstester (vind, spår)
npx expo start           # utvecklingsserver
npm run build:web        # webbygget till dist/

cd server
npm ci --ignore-scripts  # utan flaggan kan better-sqlite3 fallera
npm test                 # serverns tester
npm run dev              # lokal server på :8787, kräver .dev.vars (kopiera .dev.vars.example)
```
Kör typecheck, lint och båda testsviterna före varje commit.

### Jaktlag i webbläsare med två användare
`verktyg/webbtest/lagtest.py` (Playwright för Python) kör hela flödet: skapa lag, bjuda in, plan, eftersök, chatt.
Tre terminaler i PowerShell (engångsvis först: `pip install playwright` och `playwright install chromium`):
```
# 1: lokal server
cd server; npx wrangler d1 migrations apply skade --local; npx wrangler dev --port 8787

# 2: webbygge mot den lokala servern, serverat på :8081 med samma säkerhetshuvuden som i drift
$env:EXPO_PUBLIC_SKADE_API = "http://localhost:8787"
npx expo export -p web --output-dir .webbtest
Remove-Item Env:EXPO_PUBLIC_SKADE_API
python verktyg/webbtest/serve.py .webbtest

# 3: testet
python verktyg/webbtest/lagtest.py
```
Skärmdumparna hamnar i systemets temp-mapp.
`TESTLAGE=1` i `server/.dev.vars` slår på inloggning med e-post och lösenord, bara för test.

## Release
- **Push till `main`** → Cloudflare bygger webben (`skade-web`, skade.hellstrom.fyi) och, om `server/` ändrats, servern (`skade-api`, api.skade.hellstrom.fyi).
- **`git push origin main:release`** → EAS bygger iOS och laddar upp till TestFlight. Byggnumret räknas upp automatiskt. Gör det bara när Filip ber om ett nytt testbygge.
- En ny inbyggd modul eller ny behörighet kräver ett nytt bygge. Ny behörighet (entitlement) kan kräva ett interaktivt bygge från Filips dator.
- Commit-meddelanden på svenska, en rad om vad och varför.

## Kända fällor
- Får `npm run typecheck` fel om expo-routers rutter (till exempel gamla rutter som `/hund/ny`) är den genererade filen `.expo/types/router.d.ts` gammal. Den skrivs om när `npx expo start` startar. Starta servern en kort stund och kör typecheck igen.
- Webben körs med `Cross-Origin-Embedder-Policy: require-corp` (för SQLite i webbläsaren). Allt från andra servrar måste gå via CORS, till exempel `crossOrigin: "anonymous"` på kartlager.
- Better Auth får inte startas i Workerns globala scope. Den skapas vid första anropet (`hamtaAuth`), med `validateSchema: false`.
- `public/_redirects` är Netlifys och får inte följa med till Cloudflare. `npm run build:web` tar bort den.
- Allt under `/api/` utom hälsa, konfig och inloggning kräver inloggning och svarar annars 401.
- Live Activity kräver iOS 17. Resten av appen stödjer iOS 15.1.
- Googles samtyckesskärm står på Testing: bara tillagda testanvändare kan logga in med Google.

## Dokumentation och arbetssätt
Projektets dokument ligger inte i repot utan i claude.ai-projektet "Skade":
- `claude/1-gjort-hittills.md`, `claude/2-planerat.md`, `claude/3-oppna-fragor-och-ideer.md` (överblickar)
- `claude/sprint-N-….md`, ett per byggd funktion, med vad som byggdes, vad som verifierats, vad som inte verifierats och en testlista
- Docs-dokumentet "Skade – Överblick" speglar överblickarna

När något blir klart, beslutas, avförs eller är en ny idé ska överblickarna uppdateras, och en byggd funktion ska få ett sprintdokument. Har sessionen inte tillgång till projektet: avsluta svaret med exakt vad som ska in i vilken överblick, så att Filip kan föra över det.

Skilj alltid på verifierat och overifierat. Det som bara går att prova i en telefon (karta, notiser, vibration, låsskärm, kamera) ska sägas rakt ut om det inte är kört där.

## Läget 2026-11-15
- Senaste funktion: sprint 17 (jaktlag, jaktplan, eftersök, chatt, påminnelse om glömt drev, haptik, hundspår på Karta-fliken, jaktår). Pushad till `main` och `release`.
- **Inte kört på en telefon:** planen och eftersöken på Apple-kartan (`src/components/karta/PlanLager.tsx`), hundspåren (`HundsparLager.tsx`), vibrationen, påminnelsen om glömt drev, QR-skanning och länken `skade://jaktlag?kod=`. De provas i TestFlight (bygget efter build 24), inte lokalt.
- Väntar: Garmin-klockan (start/stopp av drev från Instinct 2 och nyare) tills Filip har en ny klocka.
- Före externa testare: integritetspolicyn ska skrivas om (servern lagrar namn, e-post, planer, eftersök med position och chatt).
