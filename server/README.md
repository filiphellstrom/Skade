# skade-api

Skades server på `api.skade.hellstrom.fyi`: Cloudflare Worker + D1-databasen `skade`.
Sköter inloggningen (Better Auth: Sign in with Apple, Google) och kommer att få jaktlag,
jaktplaner, eftersök och chatt. Den egna historiken (drev, hundar, dokument) ligger kvar
i telefonen.

## Adresser
| Adress | Vad |
|---|---|
| `/api/auth/*` | Better Auth (inloggning, session, radera konto) |
| `/api/halsa` | Svarar `{ ok: true }` |
| `/api/konfig` | Vilka inloggningssätt som är uppsatta |
| `/api/mig` | Den inloggade användaren |

## Lokalt
```
cp .dev.vars.example .dev.vars
npm install
npm test        # startar Workern lokalt med lokal D1 och går igenom flödet
npm run dev     # http://localhost:8787
```

## Databas
Tabellerna ligger som SQL i `migrations/` och körs av `npm run deploy` före varje
driftsättning. När Better Auth uppgraderas: `npm run schema` skriver ut SQL för det som
saknas – lägg det i en ny migrationsfil.

## Driftsättning
Workers Builds bygger från `main` med rotkatalogen `server` och kör `npm run deploy`.

## Hemligheter (Worker-secrets, aldrig i repot)
- `BETTER_AUTH_SECRET` – krävs.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` – Google-inloggning.
- `APPLE_CLIENT_ID` (Services ID), `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (.p8) – Apple på webben.
  Apple i appen behöver ingen hemlighet: ID-token kontrolleras mot Apples publika nycklar
  och bundle-id `com.skade.app`.
