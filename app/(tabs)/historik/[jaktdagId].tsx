import { useCallback, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaJaktdag, raderaJaktdag, settAnteckning, settFore } from "@/db/queries/jaktdag";
import { hamtaFalltViltForJaktdag } from "@/db/queries/fallt";
import { FORE_VAL } from "@/utils/vader";
import { hamtaDrevMedHundnamnForJaktdag } from "@/db/queries/statistik";
import type { DrevMedHundnamn, FalltVilt, Fore, Jaktdag } from "@/db/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { formateraTid } from "@/hooks/useElapsedTime";
import { useFarger } from "@/theme/TemaContext";
import { Kort, Listrad } from "@/components/ui/Kort";
import { Etikett, Falt, Felrad, Skarm, ValChip, VarningsChip } from "@/components/ui/Delar";
import { Knapp } from "@/components/ui/Knapp";
import { InlineBanner } from "@/components/InlineBanner";
import { avstand } from "@/theme/tokens";
import { Txt } from "@/components/ui/Txt";
import { antalDrevText, formateraVaraktighet } from "@/utils/format";

/**
 * Detaljvy för en enskild (oftast avslutad) jaktdag i historiken - varje
 * drev den dagen med hund, tid, viltart och utfall. Länkad från en rad i
 * app/historik/index.tsx.
 *
 * Sprint 3 (2026-08-29): varje drev-kort är nu tryckbart och öppnar
 * app/jaktdag/[jaktdagId]/drev/[drevId].tsx för att redigera viltart/
 * utfall eller radera drevet - Filip: "all historik ska vara editerbar".
 * useFocusEffect hämtar om listan när man kommer tillbaka hit, så en
 * ändring eller radering syns direkt.
 *
 * 2026-11-02: "Radera jaktdag" (liten röd knapp under rubriken, som
 * "Radera drev"). Pågående jaktdagar kan inte raderas (knappen visas inte).
 * 2026-11-06: bekräftelse krävs alltid, även för en tom jaktdag - samma
 * flöde som "Radera drev" (Filip).
 */
export default function JaktdagHistorik() {
  const f = useFarger();
  const { jaktdagId } = useLocalSearchParams<{ jaktdagId: string }>();

  const [jaktdag, setJaktdag] = useState<Jaktdag | null>(null);
  const [drev, setDrev] = useState<DrevMedHundnamn[] | null>(null);
  const [raderar, setRaderar] = useState(false);
  const [visaBekraftelse, setVisaBekraftelse] = useState(false);
  const [fel, setFel] = useState<string | null>(null);
  // 2026-11-04: före, jaktdagbok och fällt vilt.
  const [fallt, setFallt] = useState<FalltVilt[]>([]);
  const [anteckning, setAnteckningText] = useState("");
  const [sparadAnteckning, setSparadAnteckning] = useState("");
  const [sparar, setSparar] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;

      (async () => {
        const db = await getDatabase();
        const [j, d, f] = await Promise.all([
          hamtaJaktdag(db, jaktdagId),
          hamtaDrevMedHundnamnForJaktdag(db, jaktdagId),
          hamtaFalltViltForJaktdag(db, jaktdagId),
        ]);
        if (!avbruten) {
          setFallt(f);
          setAnteckningText(j?.anteckning ?? "");
          setSparadAnteckning(j?.anteckning ?? "");
          setJaktdag(j);
          setDrev(d);
          setVisaBekraftelse(false);
          setFel(null);
        }
      })();

      return () => {
        avbruten = true;
      };
    }, [jaktdagId]),
  );

  if (!jaktdag || !drev) {
    return (
      <View style={[styles.laddar, { backgroundColor: f.surface100 }]}>
        <ActivityIndicator size="large" color={f.brand} />
      </View>
    );
  }

  async function radera() {
    if (raderar) return;
    setRaderar(true);
    setFel(null);
    try {
      const db = await getDatabase();
      await raderaJaktdag(db, jaktdagId);
      router.back();
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte radera jaktdagen.");
      setRaderar(false);
      setVisaBekraftelse(false);
    }
  }

  const kanRadera = jaktdag.status === "avslutad";

  async function valjFore(varde: Fore) {
    if (!jaktdag) return;
    const ny = jaktdag.fore === varde ? null : varde;
    const db = await getDatabase();
    await settFore(db, jaktdagId, ny);
    setJaktdag({ ...jaktdag, fore: ny });
  }

  async function sparaAnteckning() {
    if (sparar) return;
    setSparar(true);
    try {
      const db = await getDatabase();
      await settAnteckning(db, jaktdagId, anteckning);
      setSparadAnteckning(anteckning);
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte spara anteckningen.");
    } finally {
      setSparar(false);
    }
  }

  const avslutade = drev.filter((d) => d.endTimestamp !== null);
  const totalDrevtid = avslutade.reduce((summa, d) => summa + (d.duration ?? 0), 0);

  return (
    <Skarm>
      <ScreenHeader jaktmark={jaktdag.jaktmark} datum={new Date(jaktdag.datum * 1000)} visaTillbaka />

      {kanRadera && (
        <View style={styles.block}>
          {fel && <Felrad text={fel} />}
          {!visaBekraftelse ? (
            <Knapp
              titel="Radera jaktdag"
              variant="faraLiten"
              fullBredd
              onPress={() => setVisaBekraftelse(true)}
              laddar={raderar}
            />
          ) : (
            <>
              <InlineBanner
                text={
                  drev.length > 0 || fallt.length > 0
                    ? `Jaktdagen och ${antalDrevText(drev.length)} raderas permanent, med händelser, väder och fällt vilt. Det går inte att ångra.`
                    : "Den här jaktdagen raderas permanent. Det går inte att ångra."
                }
                typ="error"
              />
              <Knapp titel="Ja, radera permanent" variant="fara" onPress={radera} laddar={raderar} />
              <Knapp
                titel="Avbryt"
                variant="sekundar"
                onPress={() => setVisaBekraftelse(false)}
                disabled={raderar}
              />
            </>
          )}
        </View>
      )}

      {drev.length === 0 ? (
        <Kort>
          <Txt variant="body" farg="inkMuted">
            Inga drev registrerade den här jaktdagen.
          </Txt>
        </Kort>
      ) : (
        <View>
          <Etikett>{`${antalDrevText(avslutade.length).toUpperCase()} · ${formateraVaraktighet(totalDrevtid).toUpperCase()}`}</Etikett>
          <Kort lista>
            {drev.map((d, i) => {
              const saknas = d.endTimestamp !== null && (!d.species || !d.outcome);
              return (
                <Listrad
                  key={d.id}
                  forsta={i === 0}
                  titel={d.hundNamn}
                  undertitel={
                    `${new Date(d.startTimestamp * 1000).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}` +
                    (d.species || d.outcome
                      ? ` · ${[d.species, d.outcome].filter(Boolean).join(" · ")}`
                      : "")
                  }
                  extra={saknas ? <VarningsChip text={!d.species && !d.outcome ? "Saknar viltart och utfall" : !d.species ? "Saknar viltart" : "Saknar utfall"} /> : undefined}
                  hoger={d.endTimestamp !== null ? formateraTid(d.duration ?? 0) : "Pågår"}
                  hogerFarg={d.endTimestamp !== null ? "ink" : "brand"}
                  onPress={() => router.push(`/jaktdag/${jaktdagId}/drev/${d.id}`)}
                />
              );
            })}
          </Kort>
        </View>
      )}

      <View>
        <Etikett>FÖRE</Etikett>
        <View style={styles.chips}>
          {FORE_VAL.map((f) => (
            <ValChip key={f.varde} titel={f.titel} vald={jaktdag.fore === f.varde} hojd={48} onPress={() => valjFore(f.varde)} />
          ))}
        </View>
      </View>

      <View>
        <Etikett>FÄLLT VILT</Etikett>
        {fallt.length > 0 && (
          <Kort lista>
            {fallt.map((v, i) => (
              <Listrad
                key={v.id}
                forsta={i === 0}
                titel={v.antal > 1 ? `${v.art} ×${v.antal}` : v.art}
                undertitel={
                  [
                    new Date(v.tidpunkt * 1000).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }),
                    v.skytt,
                    v.drevId ? null : "utan drev",
                  ]
                    .filter(Boolean)
                    .join(" · ")
                }
                onPress={() => router.push(`/jaktdag/${jaktdagId}/fallt/${v.id}`)}
              />
            ))}
          </Kort>
        )}
        <Knapp
          variant="text"
          ikon="plus"
          titel="Lägg till fällt vilt"
          onPress={() => router.push(`/jaktdag/${jaktdagId}/fallt/ny`)}
        />
      </View>

      <View style={styles.block}>
        <Etikett>JAKTDAGBOK</Etikett>
        <Falt
          value={anteckning}
          onChangeText={setAnteckningText}
          placeholder="Hur var dagen? Vad hände?"
          multiline
          style={styles.anteckning}
          textAlignVertical="top"
        />
        {anteckning !== sparadAnteckning && (
          <Knapp titel="Spara anteckning" variant="sekundar" onPress={sparaAnteckning} laddar={sparar} />
        )}
      </View>

      {Platform.OS !== "web" && avslutade.length > 0 && (
        <Knapp variant="sekundar" ikon="dela" titel="Dela som bild" onPress={() => router.push(`/dela?typ=jaktdag&id=${jaktdagId}`)} />
      )}
    </Skarm>
  );
}

const styles = StyleSheet.create({
  block: { gap: avstand.s3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: avstand.s2 },
  anteckning: { minHeight: 120, paddingTop: avstand.s3 },
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
});
