import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaArkiveradeHundar, hamtaHundarForProfil } from "@/db/queries/hund";
import { hamtaPagaendeJaktdag } from "@/db/queries/jaktdag";
import { hamtaPagaendeDrev } from "@/db/queries/drev";
import { hamtaStatistikPerHund } from "@/db/queries/statistik";
import type { Hund, Uuid } from "@/db/types";
import { useProfil } from "@/contexts/ProfilContext";
import { useFarger } from "@/theme/TemaContext";
import { Knapp } from "@/components/ui/Knapp";
import { Kort, Listrad } from "@/components/ui/Kort";
import { Rubrikrad, Skarm } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";
import { antalDrevText, formateraVaraktighet } from "@/utils/format";

/**
 * Hundar-fliken (sprint 6). Aktiva hundar i ett listkort med ras och
 * ålder till vänster och total drevtid + antal drev till höger. Hunden
 * vars drev pågår just nu visar "Drev pågår" i brand. Tryck på en hund
 * för att redigera/arkivera/radera den (/hundar/[hundId]).
 *
 * Hundlistan låg tidigare på Hem - flyttad hit enligt designens
 * navigationskarta. Hämtas om vid varje fokus.
 */
function alder(fodelsedatum: number | null): string | null {
  if (fodelsedatum === null) {
    return null;
  }
  const fodd = new Date(fodelsedatum * 1000);
  const nu = new Date();
  let ar = nu.getFullYear() - fodd.getFullYear();
  if (
    nu.getMonth() < fodd.getMonth() ||
    (nu.getMonth() === fodd.getMonth() && nu.getDate() < fodd.getDate())
  ) {
    ar -= 1;
  }
  return ar < 1 ? "under 1 år" : `${ar} år`;
}

export default function Hundar() {
  const f = useFarger();
  const { profil } = useProfil();
  const [hundar, setHundar] = useState<Hund[] | null>(null);
  const [totaler, setTotaler] = useState<Map<Uuid, { tid: number; drev: number }>>(new Map());
  const [drevPagarHund, setDrevPagarHund] = useState<Uuid | null>(null);
  const [antalArkiverade, setAntalArkiverade] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;
      (async () => {
        const db = await getDatabase();
        const [h, stat, arkiv, j] = await Promise.all([
          hamtaHundarForProfil(db, profil.id),
          hamtaStatistikPerHund(db, profil.id),
          hamtaArkiveradeHundar(db, profil.id),
          hamtaPagaendeJaktdag(db, profil.id),
        ]);
        const drev = j ? await hamtaPagaendeDrev(db, j.id) : null;
        if (!avbruten) {
          setHundar(h);
          setTotaler(new Map(stat.map((s) => [s.hundId, { tid: s.totalDrevtid, drev: s.antalDrev }])));
          setAntalArkiverade(arkiv.length);
          setDrevPagarHund(drev?.hundId ?? null);
        }
      })();
      return () => {
        avbruten = true;
      };
    }, [profil.id]),
  );

  if (hundar === null) {
    return (
      <View style={[styles.laddar, { backgroundColor: f.surface100 }]}>
        <ActivityIndicator size="large" color={f.brand} />
      </View>
    );
  }

  return (
    <Skarm>
      <Rubrikrad
        titel="Hundar"
        handling={
          <Knapp kompakt ikon="plus" titel="Lägg till hund" onPress={() => router.push("/hundar/ny")} />
        }
      />

      {hundar.length === 0 ? (
        <Kort>
          <Txt variant="body" farg="inkMuted">
            Inga aktiva hundar. Lägg till en hund för att kunna starta en jaktdag.
          </Txt>
        </Kort>
      ) : (
        <Kort lista>
          {hundar.map((h, i) => {
            const t = totaler.get(h.id);
            const pagar = drevPagarHund === h.id;
            return (
              <Listrad
                key={h.id}
                forsta={i === 0}
                titel={h.namn}
                undertitel={[h.ras, alder(h.fodelsedatum)].filter(Boolean).join(" · ") || undefined}
                hoger={pagar ? "Drev pågår" : t ? formateraVaraktighet(t.tid) : "Inga drev än"}
                hogerFarg={pagar ? "brand" : t ? "ink" : "inkMuted"}
                hogerUnder={t ? antalDrevText(t.drev) : undefined}
                hojd={80}
                onPress={() => router.push(`/hundar/${h.id}`)}
              />
            );
          })}
        </Kort>
      )}

      {antalArkiverade > 0 && (
        <Knapp
          variant="text"
          titel={`Visa arkiverade hundar (${antalArkiverade})`}
          onPress={() => router.push("/hundar/arkiverade")}
        />
      )}
    </Skarm>
  );
}

const styles = StyleSheet.create({
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
});
