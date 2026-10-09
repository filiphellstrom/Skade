import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaArkiveradeHundar } from "@/db/queries/hund";
import { useProfil } from "@/contexts/ProfilContext";
import type { Hund } from "@/db/types";
import { useFarger } from "@/theme/TemaContext";
import { avstand } from "@/theme/tokens";
import { Kort, Listrad } from "@/components/ui/Kort";
import { Skarm, TillbakaKnapp } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/**
 * Lista över arkiverade hundar (arkiveraHund(), migration 0002) - länkad
 * från huvudskärmens "Visa arkiverade hundar". Varje rad är tryckbar och
 * öppnar samma redigeringsskärm som de aktiva hundarna
 * (app/hund/[hundId].tsx), som då visar "Återställ hund" istället för
 * "Arkivera hund" eftersom hund.arkiverad === 1.
 *
 * useFocusEffect så listan uppdateras direkt om man återställer en hund
 * och sedan går tillbaka hit - samma mönster som resten av appen.
 *
 * 2026-09-08: rubrikens paddingTop höjd 8 → 24, samma fix och motivering
 * som app/historik/index.tsx - satt för nära skärmkanten.
 */
export default function ArkiveradeHundar() {
  const f = useFarger();
  const { profil } = useProfil();

  const [hundar, setHundar] = useState<Hund[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;

      (async () => {
        const db = await getDatabase();
        const h = await hamtaArkiveradeHundar(db, profil.id);
        if (!avbruten) {
          setHundar(h);
        }
      })();

      return () => {
        avbruten = true;
      };
    }, [profil.id]),
  );

  return (
    <Skarm>
      <View style={styles.topp}>
        <TillbakaKnapp />
        <Txt variant="title1" accessibilityRole="header">
          Arkiverade hundar
        </Txt>
      </View>

      {hundar === null ? (
        <ActivityIndicator size="large" color={f.brand} />
      ) : hundar.length === 0 ? (
        <Kort>
          <Txt variant="body" farg="inkMuted">
            Inga arkiverade hundar just nu.
          </Txt>
        </Kort>
      ) : (
        <Kort lista>
          {hundar.map((h, i) => (
            <Listrad
              key={h.id}
              forsta={i === 0}
              titel={h.namn}
              undertitel={h.ras ?? undefined}
              onPress={() => router.push(`/hundar/${h.id}`)}
            />
          ))}
        </Kort>
      )}
    </Skarm>
  );
}

const styles = StyleSheet.create({
  topp: { gap: avstand.s4 },
});
