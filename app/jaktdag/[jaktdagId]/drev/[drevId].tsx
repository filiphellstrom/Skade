import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaDrev, uppdateraDrevViltartUtfall } from "@/db/queries/drev";
import type { Drev } from "@/db/types";
import { BigButton } from "@/components/BigButton";
import { ChipSelect } from "@/components/ChipSelect";
import { InlineBanner } from "@/components/InlineBanner";
import { formateraTid } from "@/hooks/useElapsedTime";
import { useThemeColors } from "@/theme/colors";

const VILTARTER = ["Rådjur", "Vildsvin", "Räv", "Hare", "Älg"];
const UTFALL = ["Fälld", "Missad", "Ingen kontakt"];

/**
 * Egen vy för viltart/utfall, öppnas direkt efter att ett drev stoppats
 * (se stopp() i .../timer.tsx som pushar hit med det nyss avslutade
 * drevets id). Beslutat 2026-08-29: ett tidigare försök lät chipsen spara
 * direkt inline på timer-skärmen utan någon Spara-knapp - Filip ville
 * istället ha ett eget steg med explicit "Spara" och "Hoppa över", så
 * valen här är lokala tills man trycker Spara.
 *
 * "Hoppa över" lämnar drevets species/outcome orörda (oftast NULL om det
 * är första gången) och går tillbaka till timern utan att spara något.
 * Båda knapparna navigerar tillbaka med router.back() - skärmen är alltid
 * pushad ovanpå en redan monterad timer-instans, som hämtar om sin data
 * (bl.a. "Senaste drevet: mm:ss") när den återfår fokus.
 */
export default function DrevViltartUtfall() {
  const colors = useThemeColors();
  const { jaktdagId, drevId } = useLocalSearchParams<{
    jaktdagId: string;
    drevId: string;
  }>();

  const [drev, setDrev] = useState<Drev | null>(null);
  const [species, setSpecies] = useState("");
  const [outcome, setOutcome] = useState("");
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;

      (async () => {
        const db = await getDatabase();
        const d = await hamtaDrev(db, drevId);
        if (avbruten) {
          return;
        }
        if (d) {
          setDrev(d);
          setSpecies(d.species ?? "");
          setOutcome(d.outcome ?? "");
        }
        setFel(null);
      })();

      return () => {
        avbruten = true;
      };
    }, [drevId]),
  );

  const tillbaka = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/jaktdag/${jaktdagId}/timer`);
    }
  };

  const spara = async () => {
    if (sparar) {
      return;
    }
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      await uppdateraDrevViltartUtfall(db, drevId, { species, outcome });
      tillbaka();
    } catch (e) {
      setFel(
        e instanceof Error ? e.message : "Kunde inte spara viltart/utfall.",
      );
      setSparar(false);
    }
  };

  const hoppaOver = () => {
    if (sparar) {
      return;
    }
    tillbaka();
  };

  if (!drev) {
    return (
      <View style={[styles.laddar, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.innehall}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.rubrik, { color: colors.text }]}>Drevet stoppat</Text>
      <Text style={[styles.undertitel, { color: colors.textMuted }]}>
        {formateraTid(drev.duration ?? 0)} - vill du ange viltart och utfall?
      </Text>

      <View style={styles.faltblock}>
        <ChipSelect
          label="Viltart"
          options={VILTARTER}
          value={species}
          onChange={setSpecies}
        />
        <ChipSelect
          label="Utfall"
          options={UTFALL}
          value={outcome}
          onChange={setOutcome}
        />
      </View>

      {fel && <InlineBanner text={fel} typ="error" />}

      <View style={styles.knappblock}>
        <BigButton label="Spara" onPress={spara} laddar={sparar} />
        <BigButton
          label="Hoppa över"
          variant="secondary"
          onPress={hoppaOver}
          disabled={sparar}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  innehall: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 24,
  },
  rubrik: { fontSize: 26, fontWeight: "800" },
  undertitel: { fontSize: 15, fontWeight: "600", marginTop: -12 },
  faltblock: { gap: 20 },
  knappblock: { gap: 12, marginTop: 8 },
});
