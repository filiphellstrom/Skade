import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaJaktmarkerMedSummering } from "@/db/queries/jaktmark";
import type { JaktmarkMedSummering } from "@/db/types";
import { useProfil } from "@/contexts/ProfilContext";
import { useFarger } from "@/theme/TemaContext";
import { Knapp } from "@/components/ui/Knapp";
import { Kort, Listrad } from "@/components/ui/Kort";
import { Rubrikrad, Skarm } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";
import { formateraDag, formateraVaraktighet } from "@/utils/format";

/**
 * Jaktmarker-fliken (sprint 6). Varje jaktmark med antal jaktdagar,
 * senaste jaktdag och total drevtid. Senast använda först. Tryck för att
 * döpa om. "Lägg till jaktmark" skapar en mark utan att starta en
 * jaktdag. Wehunt-id finns i databasen men visas/redigeras inte här.
 */
export default function Jaktmarker() {
  const f = useFarger();
  const { profil } = useProfil();
  const [marker, setMarker] = useState<JaktmarkMedSummering[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;
      (async () => {
        const db = await getDatabase();
        const m = await hamtaJaktmarkerMedSummering(db, profil.id);
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
      <Rubrikrad
        titel="Jaktmarker"
        handling={
          <Knapp kompakt ikon="plus" titel="Lägg till" onPress={() => router.push("/jaktmarker/ny")} accessibilityLabel="Lägg till jaktmark" />
        }
      />
      {marker.length === 0 ? (
        <Kort>
          <Txt variant="body" farg="inkMuted">
            Inga jaktmarker än. Lägg till en här, eller skriv en ny när du startar en jaktdag.
          </Txt>
        </Kort>
      ) : (
        <Kort lista>
          {marker.map((m, i) => (
            <Listrad
              key={m.id}
              forsta={i === 0}
              ikon="jaktmark"
              titel={m.namn}
              undertitel={
                m.antalJaktdagar === 0
                  ? "Ingen jaktdag än"
                  : `${m.antalJaktdagar} ${m.antalJaktdagar === 1 ? "jaktdag" : "jaktdagar"} · senast ${formateraDag(m.senastDatum ?? 0)}`
              }
              hoger={m.antalJaktdagar > 0 ? formateraVaraktighet(m.totalDrevtid) : undefined}
              hojd={80}
              onPress={() => router.push(`/jaktmarker/${m.id}`)}
            />
          ))}
        </Kort>
      )}
    </Skarm>
  );
}

const styles = StyleSheet.create({
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
});
