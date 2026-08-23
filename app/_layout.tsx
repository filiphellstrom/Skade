import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaEllerSkapaProfil } from "@/db/queries/profil";
import type { Profil } from "@/db/types";
import { ProfilProvider } from "@/contexts/ProfilContext";
import { OnboardingScreen } from "@/screens/OnboardingScreen";
import { useThemeColors } from "@/theme/colors";

/**
 * Rot-layout: initierar SQLite-databasen (öppnar anslutning, kör
 * migrations) och hämtar/skapar profilen innan några skärmar renderas.
 * Se src/db/client.ts och src/db/queries/profil.ts.
 *
 * Tomt profilnamn = appen har aldrig körts klart genom onboardingen förut
 * (se OnboardingScreen). Så länge det är fallet renderas OnboardingScreen
 * direkt istället för <Stack/> - en gate i layouten, inte en router-route,
 * så det inte finns någon navigationsväg runt den.
 */
export default function RootLayout() {
  const colors = useThemeColors();
  const [databasKlar, setDatabasKlar] = useState(false);
  const [profil, setProfil] = useState<Profil | null>(null);

  useEffect(() => {
    getDatabase()
      .then((db) => hamtaEllerSkapaProfil(db))
      .then((p) => {
        setProfil(p);
        setDatabasKlar(true);
      });
  }, []);

  if (!databasKlar || !profil) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (profil.namn.trim() === "") {
    return <OnboardingScreen profil={profil} onKlar={setProfil} />;
  }

  return (
    <ProfilProvider initialProfil={profil}>
      <Stack screenOptions={{ headerShown: false }} />
    </ProfilProvider>
  );
}
