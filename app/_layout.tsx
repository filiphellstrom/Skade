import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
  SchibstedGrotesk_800ExtraBold,
} from "@expo-google-fonts/schibsted-grotesk";
import { getDatabase } from "@/db/client";
import { hamtaEllerSkapaProfil } from "@/db/queries/profil";
import type { Profil } from "@/db/types";
import { ProfilProvider } from "@/contexts/ProfilContext";
import { OnboardingScreen } from "@/screens/OnboardingScreen";
import { SidMinne, laddaSenasteSida } from "@/hooks/senasteSida";
import {
  TemaProvider,
  laddaTemaInstallningar,
  useSystemFarger,
  useTema,
} from "@/theme/TemaContext";
import type { TemaVal, TimerTemaVal } from "@/theme/TemaContext";

// Splashen ligger kvar tills typsnitt, tema-val och databas är laddade,
// så att första bilden aldrig visas i fel typsnitt eller fel tema.
SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Rot-layout: laddar Schibsted Grotesk, sparade tema-val och SQLite
 * (öppnar anslutning, kör migrations, hämtar/skapar profilen) innan
 * några skärmar renderas. Se src/db/client.ts, src/db/queries/profil.ts
 * och src/theme/TemaContext.tsx.
 *
 * Tomt profilnamn = appen har aldrig körts klart genom onboardingen förut
 * (se OnboardingScreen). Så länge det är fallet renderas OnboardingScreen
 * direkt istället för <Stack/> - en gate i layouten, inte en router-route,
 * så det inte finns någon navigationsväg runt den.
 */
export default function RootLayout() {
  const systemFarger = useSystemFarger();
  const [fontLaddad, fontFel] = useFonts({
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_500Medium,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
    SchibstedGrotesk_800ExtraBold,
  });
  const [profil, setProfil] = useState<Profil | null>(null);
  const [tema, setTema] = useState<{
    temaVal: TemaVal;
    timerTemaVal: TimerTemaVal | null;
  } | null>(null);
  // undefined = inte laddad än, null = starta på Hem (src/hooks/senasteSida.tsx).
  const [startsida, setStartsida] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    // I tur och ordning, inte parallellt: på webben kraschar SQLite-motorn
    // (wa-sqlite) om appens databas och inställningslagringen öppnas
    // samtidigt ("reading 'xFileControl'").
    (async () => {
      const db = await getDatabase();
      setProfil(await hamtaEllerSkapaProfil(db));
      setTema(await laddaTemaInstallningar());
      setStartsida(await laddaSenasteSida(db));
    })();
  }, []);

  // Ett fontfel får inte låsa appen - då används systemets sans.
  const klar =
    (fontLaddad || !!fontFel) && profil !== null && tema !== null && startsida !== undefined;

  useEffect(() => {
    if (klar) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [klar]);

  if (!klar) {
    return <View style={{ flex: 1, backgroundColor: systemFarger.surface100 }} />;
  }

  return (
    <TemaProvider initial={tema}>
      <TemaStatusBar />
      {profil.namn.trim() === "" ? (
        <OnboardingScreen profil={profil} onKlar={setProfil} />
      ) : (
        <ProfilProvider initialProfil={profil}>
          <AppStack startsida={startsida ?? null} />
        </ProfilProvider>
      )}
    </TemaProvider>
  );
}

function TemaStatusBar() {
  const { schema } = useTema();
  return <StatusBar style={schema === "dark" ? "light" : "dark"} />;
}

function AppStack({ startsida }: { startsida: string | null }) {
  const { farger } = useTema();
  return (
    <>
      <SidMinne startsida={startsida} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: farger.surface100 },
        }}
      />
    </>
  );
}
