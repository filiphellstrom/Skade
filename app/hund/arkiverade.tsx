import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaArkiveradeHundar } from "@/db/queries/hund";
import { useProfil } from "@/contexts/ProfilContext";
import type { Hund } from "@/db/types";
import { BackButton } from "@/components/BackButton";
import { InfoRow } from "@/components/InfoRow";
import { useThemeColors } from "@/theme/colors";

/**
 * Lista över arkiverade hundar (arkiveraHund(), migration 0002) - länkad
 * från huvudskärmens "Visa arkiverade hundar". Varje rad är tryckbar och
 * öppnar samma redigeringsskärm som de aktiva hundarna
 * (app/hund/[hundId].tsx), som då visar "Återställ hund" istället för
 * "Arkivera hund" eftersom hund.arkiverad === 1.
 *
 * useFocusEffect så listan uppdateras direkt om man återställer en hund
 * och sedan går tillbaka hit - samma mönster som resten av appen.
 */
export default function ArkiveradeHundar() {
  const colors = useThemeColors();
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
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.backRad}>
        <BackButton />
      </View>

      {hundar === null ? (
        <View style={styles.laddar}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.innehall}>
          <Text style={[styles.rubrik, { color: colors.text }]}>
            Arkiverade hundar
          </Text>

          {hundar.length === 0 ? (
            <Text style={[styles.tomText, { color: colors.textMuted }]}>
              Inga arkiverade hundar just nu.
            </Text>
          ) : (
            <View style={styles.lista}>
              {hundar.map((h) => (
                <InfoRow
                  key={h.id}
                  titel={h.namn}
                  undertitel={h.ras ?? undefined}
                  onPress={() => router.push(`/hund/${h.id}`)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backRad: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  innehall: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 20,
  },
  rubrik: { fontSize: 28, fontWeight: "800", marginBottom: 4 },
  tomText: { fontSize: 16, textAlign: "center", marginTop: 24 },
  lista: { gap: 10 },
});
