import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaJaktdag, settAktivHund } from "@/db/queries/jaktdag";
import { hamtaHundarForProfil, laggTillHundIJaktdag } from "@/db/queries/hund";
import { useProfil } from "@/contexts/ProfilContext";
import type { Hund, Jaktdag, Uuid } from "@/db/types";
import { BigButton } from "@/components/BigButton";
import { SelectableCard } from "@/components/SelectableCard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { InlineBanner } from "@/components/InlineBanner";
import { useThemeColors } from "@/theme/colors";

/**
 * Sida 2: Välj hund. Kopplar en eller flera hundar till jaktdagen
 * (laggTillHundIJaktdag) och sätter vilken av dem som är aktiv just nu
 * (settAktivHund) - bara en hund kan drevas åt gången per jaktdag, se
 * idx_one_active_drev_per_jaktdag i schemat.
 *
 * Om fler än en hund väljs visas ett extra "vilken hund driver just nu"-
 * val innan man kan bekräfta. Väljs bara en hund sätts den automatiskt
 * som aktiv.
 */
export default function ValjHund() {
  const colors = useThemeColors();
  const { profil } = useProfil();
  const { jaktdagId } = useLocalSearchParams<{ jaktdagId: string }>();

  const [jaktdag, setJaktdag] = useState<Jaktdag | null>(null);
  const [hundar, setHundar] = useState<Hund[] | null>(null);
  const [valda, setValda] = useState<Set<Uuid>>(new Set());
  const [aktivHundId, setAktivHundId] = useState<Uuid | null>(null);
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  useEffect(() => {
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
  }, [jaktdagId, profil.id]);

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
    router.push(`/hund/ny?jaktdagId=${jaktdagId}`);

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
      <View
        style={[
          styles.laddar,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.innehall}
    >
      <ScreenHeader
        jaktmark={jaktdag.jaktmark}
        datum={new Date(jaktdag.datum * 1000)}
      />

      <Text style={[styles.rubrik, { color: colors.text }]}>Välj hund</Text>

      {hundar.length === 0 ? (
        <View style={styles.tomtLista}>
          <Text style={[styles.tomText, { color: colors.textMuted }]}>
            Du har inga hundar registrerade än.
          </Text>
          <BigButton label="Lägg till hund" onPress={laggTillHundLank} />
        </View>
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
          </View>

          <BigButton
            label="+ Lägg till hund"
            variant="secondary"
            onPress={laggTillHundLank}
          />

          {valdaLista.length > 1 && (
            <View style={styles.aktivBlock}>
              <Text style={[styles.delrubrik, { color: colors.text }]}>
                Vilken hund driver just nu?
              </Text>
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

          {fel && <InlineBanner text={fel} typ="error" />}

          <View style={styles.knappblock}>
            <BigButton
              label="Bekräfta"
              onPress={bekrafta}
              disabled={!kanBekrafta}
              laddar={sparar}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  innehall: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 16,
  },
  rubrik: { fontSize: 24, fontWeight: "800", marginBottom: 4 },
  delrubrik: { fontSize: 17, fontWeight: "700", marginBottom: 4 },
  lista: { gap: 10 },
  tomtLista: { gap: 16, paddingVertical: 24 },
  tomText: { fontSize: 16, textAlign: "center" },
  aktivBlock: { marginTop: 8, gap: 10 },
  knappblock: { marginTop: 12 },
});
