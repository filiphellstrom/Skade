import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaJaktmarkerForProfil } from "@/db/queries/jaktmark";
import type { Jaktmark } from "@/db/types";
import { useProfil } from "@/contexts/ProfilContext";
import { useFarger } from "@/theme/TemaContext";
import { Kort, Listrad } from "@/components/ui/Kort";
import { Rubrikrad, Skarm } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/**
 * Jaktmarker-fliken. Steg 3 i sprint 6: enkel lista. Byggs ut i steg 5
 * (antal jaktdagar, senast, total tid, lägg till, döp om).
 */
export default function Jaktmarker() {
  const f = useFarger();
  const { profil } = useProfil();
  const [marker, setMarker] = useState<Jaktmark[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;
      (async () => {
        const db = await getDatabase();
        const m = await hamtaJaktmarkerForProfil(db, profil.id);
        if (!avbruten) {
          setMarker(m);
        }
      })();
      return () => {
        avbruten = true;
      };
    }, [profil.id]),
  );

  if (marker === null) {
    return (
      <View style={[styles.laddar, { backgroundColor: f.surface100 }]}>
        <ActivityIndicator size="large" color={f.brand} />
      </View>
    );
  }

  return (
    <Skarm>
      <Rubrikrad titel="Jaktmarker" />
      {marker.length === 0 ? (
        <Kort>
          <Txt variant="body" farg="inkMuted">
            Inga jaktmarker än. De skapas när du startar en jaktdag.
          </Txt>
        </Kort>
      ) : (
        <Kort lista>
          {marker.map((m, i) => (
            <Listrad key={m.id} forsta={i === 0} ikon="jaktmark" titel={m.namn} />
          ))}
        </Kort>
      )}
    </Skarm>
  );
}

const styles = StyleSheet.create({
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
});
