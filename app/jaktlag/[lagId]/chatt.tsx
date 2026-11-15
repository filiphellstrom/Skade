import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  avblockera,
  blockera,
  felText,
  rapporteraMeddelande,
  skickaMeddelande,
  taBortMeddelande,
  useLagData,
  useSynk,
} from "@/jaktlag/lager";
import { dagOchTid } from "@/jaktlag/format";
import type { Meddelande } from "@/jaktlag/typer";
import { useTema } from "@/theme/TemaContext";
import { avstand, radie, tryck, typ } from "@/theme/tokens";
import { KraverKonto } from "@/components/jaktlag/KraverKonto";
import { InlineBanner } from "@/components/InlineBanner";
import { Knapp } from "@/components/ui/Knapp";
import { TillbakaKnapp } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/**
 * Jaktlagets chatt (2026-11-15), så att hundförarna kan prata utan att
 * störa på jaktradion.
 *
 * - Hämtar nytt var 5:e sekund medan skärmen visas. Inga push-notiser:
 *   meddelanden syns bara när appen är öppen.
 * - Ett meddelande som skrivs utan täckning visas direkt, märkt
 *   "skickas…", och går iväg när täckningen är tillbaka.
 * - Tryck på ett meddelande för att ta bort (egna; ansvariga även andras),
 *   rapportera eller blockera avsändaren. Rapporter sparas på servern.
 *   Blockerar man någon döljs den personens meddelanden för en själv.
 */
export default function Chatt() {
  return <KraverKonto titel="Chatt">{(jag) => <Innehall jag={jag} />}</KraverKonto>;
}

function Innehall({ jag }: { jag: { id: string; namn: string } }) {
  const { lagId } = useLocalSearchParams<{ lagId: string }>();
  const { farger } = useTema();
  const insets = useSafeAreaInsets();
  const data = useLagData(lagId);
  const [text, setText] = useState("");
  const [vald, setVald] = useState<Meddelande | null>(null);
  const [fel, setFel] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [visaBlockerade, setVisaBlockerade] = useState(false);
  const lista = useRef<ScrollView>(null);
  useSynk(lagId, 5000, () => router.replace("/jaktlag"));

  const meddelanden = data?.meddelanden ?? [];
  const antal = meddelanden.length;
  useEffect(() => {
    // Nytt meddelande: visa det senaste.
    const t = setTimeout(() => lista.current?.scrollToEnd({ animated: false }), 50);
    return () => clearTimeout(t);
  }, [antal]);

  const skicka = () => {
    const t = text.trim();
    if (t === "" || !lagId) return;
    setText("");
    setFel(null);
    skickaMeddelande(lagId, jag, t).catch((e) => setFel(felText(e)));
  };

  const gor = async (jobb: () => Promise<void>, klarText?: string) => {
    setFel(null);
    setInfo(null);
    try {
      await jobb();
      if (klarText) setInfo(klarText);
    } catch (e) {
      setFel(felText(e));
    } finally {
      setVald(null);
    }
  };

  const ansvarig = data?.lag.minRoll === "ansvarig";
  const blockerade = data?.blockerade ?? [];
  const namnFor = (userId: string) => data?.medlemmar.find((m) => m.userId === userId)?.namn ?? "Tidigare medlem";

  return (
    <KeyboardAvoidingView
      style={[styles.fyll, { backgroundColor: farger.surface100 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.topp, { paddingTop: insets.top + avstand.s3, borderBottomColor: farger.border }]}>
        <TillbakaKnapp />
        <View style={styles.flex1}>
          <Txt variant="heading" numberOfLines={1}>
            Chatt
          </Txt>
          <Txt variant="caption" farg="inkMuted" numberOfLines={1}>
            {data?.lag.namn ?? ""}
          </Txt>
        </View>
        {blockerade.length > 0 && (
          <Knapp
            titel={`Blockerade (${blockerade.length})`}
            variant="text"
            onPress={() => setVisaBlockerade(!visaBlockerade)}
          />
        )}
      </View>

      {visaBlockerade && blockerade.length > 0 && (
        <View style={[styles.panel, { backgroundColor: farger.surface200, borderBottomColor: farger.border }]}>
          {blockerade.map((id) => (
            <View key={id} style={styles.panelRad}>
              <Txt style={styles.flex1}>{namnFor(id)}</Txt>
              <Knapp titel="Sluta blockera" variant="text" onPress={() => gor(() => avblockera(lagId, id))} />
            </View>
          ))}
        </View>
      )}

      <ScrollView
        ref={lista}
        style={styles.fyll}
        contentContainerStyle={styles.lista}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => lista.current?.scrollToEnd({ animated: false })}
      >
        {meddelanden.length === 0 && (
          <Txt farg="inkMuted" style={styles.tomt}>
            Inga meddelanden än. Här kan hundförarna stämma av utan att ta plats på radion. Meddelanden syns
            bara när appen är öppen – det kommer inga notiser.
          </Txt>
        )}
        {meddelanden.map((m) => {
          const min = m.userId === jag.id;
          const markerad = vald?.id === m.id;
          return (
            <View key={m.id} style={[styles.rad, min && styles.radMin]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${m.namn}: ${m.borttaget ? "borttaget meddelande" : m.text}`}
                accessibilityHint="Visar val för meddelandet"
                disabled={!!m.borttaget || !!m.vantar}
                onPress={() => setVald(markerad ? null : m)}
                style={[
                  styles.bubbla,
                  {
                    backgroundColor: min ? farger.brandSoft : farger.surface200,
                    borderColor: markerad ? farger.brand : "transparent",
                  },
                ]}
              >
                {!min && (
                  <Txt variant="caption" farg="brand">
                    {m.namn}
                  </Txt>
                )}
                <Txt farg={m.borttaget ? "inkMuted" : "ink"} selectable={!m.borttaget}>
                  {m.borttaget ? "Meddelandet är borttaget" : m.text}
                </Txt>
                <Txt variant="caption" farg="inkMuted" style={styles.tid}>
                  {m.vantar ? "Skickas när det finns täckning…" : dagOchTid(m.skapad)}
                </Txt>
              </Pressable>
              {markerad && (
                <View style={styles.val}>
                  {(min || ansvarig) && (
                    <Knapp titel="Ta bort" variant="faraLiten" onPress={() => gor(() => taBortMeddelande(lagId, m.id))} />
                  )}
                  {!min && (
                    <>
                      <Knapp
                        titel="Rapportera"
                        variant="faraLiten"
                        onPress={() =>
                          gor(() => rapporteraMeddelande(m.id, ""), "Meddelandet är rapporterat. Tack för att du sa till.")
                        }
                      />
                      <Knapp
                        titel={`Blockera ${m.namn}`}
                        variant="faraLiten"
                        onPress={() =>
                          gor(() => blockera(lagId, m.userId), `${m.namn} är blockerad. Du ser inte längre personens meddelanden.`)
                        }
                      />
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View
        style={[
          styles.botten,
          {
            backgroundColor: farger.surface200,
            borderTopColor: farger.border,
            paddingBottom: Math.max(insets.bottom, avstand.s3),
          },
        ]}
      >
        {fel && <InlineBanner text={fel} />}
        {info && <InlineBanner text={info} typ="info" />}
        <View style={styles.skrivrad}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Skriv till hundförarna"
            placeholderTextColor={farger.inkMuted}
            accessibilityLabel="Meddelande"
            multiline
            maxLength={1000}
            style={[
              typ.body,
              styles.inmatning,
              { color: farger.ink, backgroundColor: farger.surface300, borderColor: farger.borderStrong },
            ]}
            onSubmitEditing={Platform.OS === "web" ? skicka : undefined}
            submitBehavior={Platform.OS === "web" ? "submit" : undefined}
          />
          <Knapp titel="Skicka" onPress={skicka} disabled={text.trim() === ""} fullBredd={false} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fyll: { flex: 1 },
  flex1: { flex: 1 },
  topp: {
    flexDirection: "row",
    alignItems: "center",
    gap: avstand.s3,
    paddingHorizontal: avstand.s4,
    paddingBottom: avstand.s3,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  panel: { paddingHorizontal: avstand.s4, paddingVertical: avstand.s2, borderBottomWidth: StyleSheet.hairlineWidth },
  panelRad: { flexDirection: "row", alignItems: "center", gap: avstand.s3 },
  lista: { padding: avstand.s4, gap: avstand.s3 },
  tomt: { textAlign: "center", marginTop: avstand.s6 },
  rad: { alignItems: "flex-start", gap: avstand.s2 },
  radMin: { alignItems: "flex-end" },
  bubbla: {
    maxWidth: "86%",
    borderRadius: radie.md,
    borderWidth: 2,
    paddingHorizontal: avstand.s3,
    paddingVertical: avstand.s2,
    gap: 2,
  },
  tid: { alignSelf: "flex-end" },
  val: { flexDirection: "row", flexWrap: "wrap", gap: avstand.s2 },
  botten: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: avstand.s4,
    paddingTop: avstand.s3,
    gap: avstand.s2,
  },
  skrivrad: { flexDirection: "row", alignItems: "flex-end", gap: avstand.s3 },
  inmatning: {
    flex: 1,
    minHeight: tryck.min,
    maxHeight: 140,
    borderRadius: radie.md,
    borderWidth: 1,
    paddingHorizontal: avstand.s3,
    paddingVertical: avstand.s3,
  },
});
