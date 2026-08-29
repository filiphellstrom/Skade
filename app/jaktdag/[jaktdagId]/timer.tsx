import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { avslutaJaktdag, hamtaJaktdag, settAktivHund } from "@/db/queries/jaktdag";
import { hamtaHundarForJaktdag } from "@/db/queries/hund";
import {
  hamtaPagaendeDrev,
  hamtaSenasteDrev,
  startaDrev,
  stoppaDrev,
} from "@/db/queries/drev";
import type { Drev, Hund, Jaktdag } from "@/db/types";
import { BigButton } from "@/components/BigButton";
import { SelectableCard } from "@/components/SelectableCard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { InlineBanner } from "@/components/InlineBanner";
import { TimerDisplay } from "@/components/TimerDisplay";
import { useElapsedTime, formateraTid } from "@/hooks/useElapsedTime";
import { useThemeColors } from "@/theme/colors";

/**
 * Sida 3: Starta/stoppa timer. Robust mot att appen dödas/backgroundas
 * mitt i ett drev - vid mount hämtas ett ev. pågående drev direkt från
 * databasen (hamtaPagaendeDrev), inte från något sparat JS-state. Den
 * synliga klockan (useElapsedTime) räknar bara om `nu - startTimestamp`
 * varje sekund; startTimestamp är källan till sanning.
 *
 * Sprint 3: när ett drev stoppas navigeras man direkt vidare till
 * app/jaktdag/[jaktdagId]/drev/[drevId].tsx för att (valfritt) välja
 * viltart/utfall - se stopp() nedan. Den vyn har egna Spara/Hoppa över-
 * knappar (beslutat 2026-08-29, ersätter ett tidigare försök med
 * spara-direkt-chips direkt här på timern). `senasteDrev` hämtas ändå kvar
 * vid mount/fokus (hamtaSenasteDrev()) bara för att visa "Senaste drevet:
 * mm:ss" på timern - ingen inmatning kvar här.
 */
export default function Timer() {
  const colors = useThemeColors();
  const { jaktdagId } = useLocalSearchParams<{ jaktdagId: string }>();

  const [jaktdag, setJaktdag] = useState<Jaktdag | null>(null);
  const [hundarPaJaktdagen, setHundarPaJaktdagen] = useState<Hund[]>([]);
  const [pagaendeDrev, setPagaendeDrev] = useState<Drev | null>(null);
  const [senasteDrev, setSenasteDrev] = useState<Drev | null>(null);
  const [visaBytHund, setVisaBytHund] = useState(false);
  const [laddat, setLaddat] = useState(false);
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  // Hämtar om vid varje fokus, inte bara vid montering - se motivering i
  // app/index.tsx. Här betyder det bland annat att hundlistan för
  // byt-hund-läget är färsk om man t.ex. lagt till en hund på jaktdagen
  // från ett annat håll medan man var borta från timern.
  useFocusEffect(
    useCallback(() => {
      let avbruten = false;

      (async () => {
        const db = await getDatabase();
        const [j, hundar, drev, senaste] = await Promise.all([
          hamtaJaktdag(db, jaktdagId),
          hamtaHundarForJaktdag(db, jaktdagId),
          hamtaPagaendeDrev(db, jaktdagId),
          hamtaSenasteDrev(db, jaktdagId),
        ]);
        if (!avbruten) {
          setJaktdag(j);
          setHundarPaJaktdagen(hundar);
          setPagaendeDrev(drev);
          setSenasteDrev(
            !drev && senaste && senaste.endTimestamp !== null ? senaste : null,
          );
          setLaddat(true);
        }
      })();

      return () => {
        avbruten = true;
      };
    }, [jaktdagId]),
  );

  const elapsed = useElapsedTime(pagaendeDrev?.startTimestamp ?? null);

  const aktivHund = hundarPaJaktdagen.find((h) => h.id === jaktdag?.aktivHundId);

  const start = async () => {
    if (!aktivHund || sparar || pagaendeDrev) {
      return;
    }
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      const drev = await startaDrev(db, {
        jaktdagId,
        hundId: aktivHund.id,
      });
      setPagaendeDrev(drev);
      setSenasteDrev(null);
    } catch (e) {
      setFel(
        e instanceof Error
          ? "Ett drev pågår redan."
          : "Kunde inte starta drevet.",
      );
    } finally {
      setSparar(false);
    }
  };

  const stopp = async () => {
    if (!pagaendeDrev || sparar) {
      return;
    }
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      const avslutatDrev = await stoppaDrev(db, pagaendeDrev.id);
      setSenasteDrev(avslutatDrev);
      setPagaendeDrev(null);
      router.push(`/jaktdag/${jaktdagId}/drev/${avslutatDrev.id}`);
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte stoppa drevet.");
    } finally {
      setSparar(false);
    }
  };

  const bytAktivHund = async (hundId: string) => {
    if (sparar || pagaendeDrev) {
      return;
    }
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      await settAktivHund(db, jaktdagId, hundId);
      const uppdateradJaktdag = await hamtaJaktdag(db, jaktdagId);
      setJaktdag(uppdateradJaktdag);
      setVisaBytHund(false);
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte byta hund.");
    } finally {
      setSparar(false);
    }
  };

  const avsluta = async () => {
    if (sparar || pagaendeDrev) {
      return;
    }
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      await avslutaJaktdag(db, jaktdagId);
      router.replace("/");
    } catch (e) {
      setFel(
        e instanceof Error ? e.message : "Kunde inte avsluta jaktdagen.",
      );
      setSparar(false);
    }
  };

  if (!laddat || !jaktdag) {
    return (
      <View style={[styles.laddar, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        jaktmark={jaktdag.jaktmark}
        datum={new Date(jaktdag.datum * 1000)}
        visaTillbaka
      />

      <ScrollView
        contentContainerStyle={styles.scrollInnehall}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.mitten}>
          <Text style={[styles.hundnamn, { color: colors.text }]}>
            {aktivHund?.namn ?? "Ingen hund vald"}
          </Text>

          {hundarPaJaktdagen.length > 1 && !pagaendeDrev && (
            <BigButton
              label={visaBytHund ? "Avbryt hundbyte" : "Byt hund"}
              variant="secondary"
              onPress={() => setVisaBytHund((v) => !v)}
            />
          )}

          {visaBytHund && (
            <View style={styles.lista}>
              {hundarPaJaktdagen.map((hund) => (
                <SelectableCard
                  key={hund.id}
                  titel={hund.namn}
                  vald={hund.id === jaktdag.aktivHundId}
                  onPress={() => bytAktivHund(hund.id)}
                  typ="radio"
                />
              ))}
            </View>
          )}

          <TimerDisplay sekunder={elapsed} pagar={pagaendeDrev !== null} />

          {senasteDrev && !pagaendeDrev && (
            <Text style={[styles.senasteDrevTid, { color: colors.textMuted }]}>
              Senaste drevet: {formateraTid(senasteDrev.duration ?? 0)}
            </Text>
          )}

          {fel && <InlineBanner text={fel} typ="error" />}
        </View>

        <View style={styles.knappblock}>
          {pagaendeDrev ? (
            <BigButton
              label="Stoppa drev"
              variant="danger"
              onPress={stopp}
              laddar={sparar}
            />
          ) : (
            <BigButton
              label="Starta drev"
              onPress={start}
              disabled={!aktivHund}
              laddar={sparar}
            />
          )}

          <BigButton
            label="Avsluta jaktdag"
            variant="secondary"
            onPress={avsluta}
            disabled={pagaendeDrev !== null}
            laddar={sparar && pagaendeDrev === null}
          />
          {pagaendeDrev !== null && (
            <Text style={[styles.avslutaHint, { color: colors.textMuted }]}>
              Stoppa det pågående drevet för att kunna avsluta jaktdagen.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: {
    flex: 1,
    paddingTop: 24,
  },
  scrollInnehall: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 24,
  },
  mitten: {
    alignItems: "center",
    gap: 14,
    width: "100%",
  },
  hundnamn: {
    fontSize: 22,
    fontWeight: "800",
  },
  senasteDrevTid: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },
  lista: {
    width: "100%",
    gap: 10,
  },
  knappblock: {
    gap: 12,
  },
  avslutaHint: {
    fontSize: 13,
    textAlign: "center",
  },
});
