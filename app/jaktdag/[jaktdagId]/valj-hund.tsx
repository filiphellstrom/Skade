import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaJaktdag, settAktivHund } from "@/db/queries/jaktdag";
import { hamtaHundarForProfil, laggTillHundIJaktdag } from "@/db/queries/hund";
import { useProfil } from "@/contexts/ProfilContext";
import type { Hund, Jaktdag, Uuid } from "@/db/types";
import { SelectableCard } from "@/components/SelectableCard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useFarger } from "@/theme/TemaContext";
import { avstand } from "@/theme/tokens";
import { Knapp } from "@/components/ui/Knapp";
import { Kort } from "@/components/ui/Kort";
import { Etikett, Felrad, Skarm } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/**
 * Sida 2: Välj hund. Kopplar en eller flera hundar till jaktdagen
 * (laggTillHundIJaktdag) och sätter vilken av dem som är aktiv just nu
 * (settAktivHund) - bara en hund kan drevas åt gången per jaktdag, se
 * idx_one_active_drev_per_jaktdag i schemat.
 *
 * Om fler än en hund väljs visas ett extra "vilken hund driver just nu"-
 * val innan man kan bekräfta. Väljs bara en hund sätts den automatiskt
 * som aktiv.
 *
 * 2026-09-08: rubriken bytt från "Välj hund" till "Välj hundar som ska
 * jaga" - tydligare att man kan välja flera. Texten används bara här
 * (kontrollerat att inget annat skärm återanvänder strängen).
 */
export default function ValjHund() {
  const f = useFarger();
  const { profil } = useProfil();
  const { jaktdagId } = useLocalSearchParams<{ jaktdagId: string }>();

  const [jaktdag, setJaktdag] = useState<Jaktdag | null>(null);
  const [hundar, setHundar] = useState<Hund[] | null>(null);
  const [valda, setValda] = useState<Set<Uuid>>(new Set());
  const [aktivHundId, setAktivHundId] = useState<Uuid | null>(null);
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  // Hämtar om vid varje fokus, inte bara vid montering - se motivering i
  // app/index.tsx (samma buggklass: en hund kan ha lagts till från ett
  // annat håll medan man var borta från den här skärmen).
  useFocusEffect(
    useCallback(() => {
      let avbruten = false;

      (async () => {
        const db = await getDatabase();
        const [j, h] = await Promise.all([
          hamtaJaktdag(db, jaktdagId),
          hamtaHundarForProfil(db, profil.id),
        ]);
        if (!avbruten) {
          setJaktdag(j);
          setHundar(h);
        }
      })();

      return () => {
        avbruten = true;
      };
    }, [jaktdagId, profil.id]),
  );

  const vaxlaVal = useCallback(
    (hundId: Uuid) => {
      setValda((tidigare) => {
        const nya = new Set(tidigare);
        if (nya.has(hundId)) {
          nya.delete(hundId);
        } else {
          nya.add(hundId);
        }
        return nya;
      });
      if (aktivHundId === hundId) {
        setAktivHundId(null);
      }
    },
    [aktivHundId],
  );

  const valdaLista = Array.from(valda);
  const effektivAktivHundId =
    valdaLista.length === 1 ? valdaLista[0] : aktivHundId;
  const kanBekrafta = valdaLista.length > 0 && effektivAktivHundId !== null;

  const laggTillHundLank = () =>
    router.push(`/jaktdag/${jaktdagId}/ny-hund`);

  const bekrafta = async () => {
    if (!kanBekrafta || sparar || !effektivAktivHundId) {
      return;
    }
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      for (const hundId of valdaLista) {
        await laggTillHundIJaktdag(db, jaktdagId, hundId);
      }
      await settAktivHund(db, jaktdagId, effektivAktivHundId);
      router.replace(`/jaktdag/${jaktdagId}/timer`);
    } catch (e) {
      setFel(
        e instanceof Error ? e.message : "Kunde inte spara hundvalet.",
      );
      setSparar(false);
    }
  };

  if (!jaktdag || !hundar) {
    return (
      <View style={[styles.laddar, { backgroundColor: f.surface100 }]}>
        <ActivityIndicator size="large" color={f.brand} />
      </View>
    );
  }

  return (
    <Skarm
      sidfot={
        hundar.length > 0 ? (
          <View style={styles.sidfot}>
            <Felrad text={fel} />
            <Knapp
              titel={valdaLista.length > 1 && !aktivHundId ? "Välj vilken hund som driver" : "Bekräfta"}
              onPress={bekrafta}
              disabled={!kanBekrafta}
              laddar={sparar}
            />
          </View>
        ) : undefined
      }
    >
      <ScreenHeader
        jaktmark={jaktdag.jaktmark}
        datum={new Date(jaktdag.datum * 1000)}
        visaTillbaka
        titel="Välj hundar som ska jaga"
      />

      {hundar.length === 0 ? (
        <Kort>
          <Txt variant="body" farg="inkMuted">
            Du har inga hundar registrerade än.
          </Txt>
          <View style={styles.tomKnapp}>
            <Knapp titel="Lägg till hund" ikon="plus" onPress={laggTillHundLank} />
          </View>
        </Kort>
      ) : (
        <>
          <View style={styles.lista}>
            {hundar.map((hund) => (
              <SelectableCard
                key={hund.id}
                titel={hund.namn}
                undertitel={hund.ras ?? undefined}
                vald={valda.has(hund.id)}
                onPress={() => vaxlaVal(hund.id)}
              />
            ))}
            <Knapp titel="Lägg till hund" ikon="plus" variant="sekundar" onPress={laggTillHundLank} />
          </View>

          {valdaLista.length > 1 && (
            <View>
              <Etikett>VILKEN HUND DRIVER FÖRST?</Etikett>
              <View style={styles.lista}>
                {hundar
                  .filter((h) => valda.has(h.id))
                  .map((hund) => (
                    <SelectableCard
                      key={hund.id}
                      titel={hund.namn}
                      vald={aktivHundId === hund.id}
                      onPress={() => setAktivHundId(hund.id)}
                      typ="radio"
                    />
                  ))}
              </View>
            </View>
          )}
        </>
      )}
    </Skarm>
  );
}

const styles = StyleSheet.create({
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  lista: { gap: avstand.s2 },
  tomKnapp: { marginTop: avstand.s4 },
  sidfot: { gap: avstand.s2 },
});
