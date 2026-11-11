import type { BetterAuthOptions } from "better-auth";
import { expo } from "@better-auth/expo";
import { importPKCS8, SignJWT } from "jose";
import { appleWebbKlar, googleKlar, tillatnaOrigins, type Miljo } from "./miljo.ts";

const DAG = 60 * 60 * 24;

/**
 * Apple vill ha en signerad JWT som "client secret" i webbflödet. Den får
 * gälla högst sex månader, så den skapas på nytt i stället för att sparas.
 */
async function appleKlientHemlighet(m: Miljo): Promise<string> {
  const nyckel = await importPKCS8(m.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n"), "ES256");
  const nu = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: m.APPLE_KEY_ID! })
    .setIssuer(m.APPLE_TEAM_ID)
    .setSubject(m.APPLE_CLIENT_ID!)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(nu)
    .setExpirationTime(nu + 30 * DAG)
    .sign(nyckel);
}

/**
 * Inställningarna för Better Auth. Ligger i en egen fil utan Cloudflare-
 * importer så att scripts/auth-schema.ts kan ta fram tabellerna med samma
 * inställningar som Workern kör.
 */
export function byggAuthAlternativ(
  m: Miljo,
  database: BetterAuthOptions["database"],
): BetterAuthOptions {
  const socialProviders: NonNullable<BetterAuthOptions["socialProviders"]> = {
    // Appen loggar in med Apples inbyggda ruta och skickar en ID-token hit.
    // Den kontrolleras mot Apples publika nycklar och appens bundle-id, så
    // ingen hemlighet behövs. Webbflödet kräver Services ID + nyckel.
    apple: async () => ({
      clientId: m.APPLE_CLIENT_ID ?? m.APPLE_BUNDLE_ID,
      clientSecret: appleWebbKlar(m) ? await appleKlientHemlighet(m) : "ej-konfigurerad",
      audience: m.APPLE_CLIENT_ID ? [m.APPLE_BUNDLE_ID, m.APPLE_CLIENT_ID] : [m.APPLE_BUNDLE_ID],
      // Apple skickar bara e-postadressen vid första inloggningen. Better Auth
      // kräver en adress på varje användare, så annars används en platshållare.
      mapProfileToUser: (profil) => ({
        email: profil.email ?? `${profil.sub}@apple.skade.invalid`,
      }),
    }),
  };
  if (googleKlar(m)) {
    socialProviders.google = {
      clientId: m.GOOGLE_CLIENT_ID!,
      clientSecret: m.GOOGLE_CLIENT_SECRET!,
    };
  }

  return {
    appName: "Skade",
    baseURL: m.BETTER_AUTH_URL,
    secret: m.BETTER_AUTH_SECRET,
    database,
    trustedOrigins: ["skade://", "https://appleid.apple.com", ...tillatnaOrigins(m)],
    socialProviders,
    emailAndPassword: { enabled: m.TESTLAGE === "1" },
    plugins: [expo()],
    session: {
      // Man ska inte behöva logga in igen mitt i jaktsäsongen.
      expiresIn: 90 * DAG,
      updateAge: DAG,
      // Radera konto kräver en inloggning som är högst ett dygn gammal.
      freshAge: DAG,
    },
    account: {
      // Apples och Googles token sparas krypterade. Skade använder dem inte.
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        // "Koppla Google-konto" i profilen: Apple kan dölja e-postadressen, så
        // adresserna behöver inte vara lika när den inloggade själv kopplar.
        allowDifferentEmails: true,
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        // Jaktlag, planer, eftersök och chatt (kommande steg) ska rensas här.
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      // Tabellerna skapas av migrationerna i migrations/, som körs före varje
      // driftsättning. Kontrollen vid start behövs därför inte.
      database: { validateSchema: false },
    },
  };
}
