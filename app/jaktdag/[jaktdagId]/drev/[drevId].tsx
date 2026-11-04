import { useCallback, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import {
  hamtaDrevMedHundnamn,
  raderaDrev,
  uppdateraDrev,
} from "@/db/queries/drev";
import { hamtaHundarForJaktdag } from "@/db/queries/hund";
import type {
  DrevHandelse,
  DrevMedHundnamn,
  FalltVilt,
  Hund,
  Vader,
} from "@/db/types";
import {
  hamtaHandelserForJaktdag,
  raderaHandelse,
} from "@/db/queries/handelse";
import { hamtaVaderForDrev } from "@/db/queries/vader";
import { hamtaFalltViltForDrev } from "@/db/queries/fallt";
import { hamtaDrevMedHundnamnForJaktdag } from "@/db/queries/statistik";
import {
  HANDELSE_NAMN,
  soktid,
  sorteraHandelser,
  tapptTid,
} from "@/utils/drevhandelser";
import { VADER_KALLA, vaderText } from "@/utils/vader";
import { UTFALL, UTFALL_FALLD, VILTARTER } from "@/utils/vilt";
import { Kort, Listrad } from "@/components/ui/Kort";
import { formateraVaraktighet } from "@/utils/format";
import { ChipSelect } from "@/components/ChipSelect";
import { InlineBanner } from "@/components/InlineBanner";
import { SelectableCard } from "@/components/SelectableCard";
import { TidVal } from "@/components/TidVal";
import { formateraTid } from "@/hooks/useElapsedTime";
import { useFarger } from "@/theme/TemaContext";
import { avstand } from "@/theme/tokens";
import { Knapp } from "@/components/ui/Knapp";
import { Etikett, Felrad, Skarm } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

const klockslag = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Vy för ett enskilt drev - hund, start-/sluttid, viltart/utfall, samt
 * radering. Nås på två sätt:
 *
 * 1. Direkt efter att ett drev stoppats (stopp() i .../timer.tsx pushar
 *    hit med `?nystoppat=1`). Rubrik/text är då anpassad för det läget
 *    ("Drevet stoppat" + en fråga), och den sekundära knappen heter
 *    "Hoppa över".
 * 2. Från historiken (app/historik/[jaktdagId].tsx, ingen extra
 *    query-param) för att redigera eller radera ett äldre drev i
 *    efterhand (beslutat 2026-08-29, Filip: "all historik ska vara
 *    editerbar"). Då heter rubriken "Redigera drev", och den sekundära
 *    knappen heter "Avbryt" istället.
 *
 * Sprint 3 (2026-08-29, andra omgången - Filip svarade "Det behövs" på
 * frågan om hund-/tidsredigering): utökad med en Hund-sektion (bara
 * redigerbar, som en radiolista, om jaktdagen har fler än en hund kopplad
 * - annars bara hundens namn som text) och en Tid-sektion (Start-/Slut-
 * klockslag, med en live omräknad duration; sedan 2026-10-09 via TidVal
 * med rullhjul i ett ark). Spara-knappen
 * är avstängd om vald sluttid inte längre är efter starttiden.
 *
 * Båda entry-lägena delar samma Spara-logik (uppdateraDrev, lokalt state
 * tills man trycker Spara) och samma Radera-flöde (raderaDrev, samma
 * bekräftelsemönster som "Radera hund").
 *
 * 2026-09-08: ordningen på skärmen ändrad - "Hoppa över"/"Avbryt" och
 * "Radera drev" (med hela raderingsflödet, halva knapphöjden bevarad)
 * flyttade upp till direkt under rubriken/undertiteln, så de snabba
 * escape-vägarna nås utan att scrolla förbi alla fälten. "Spara" ligger
 * kvar sist, efter Hund/Tid/Viltart-sektionerna - man ska ha sett allt man
 * fyllt i innan man committar. Gäller båda lägena (nystoppat och
 * redigering). Felbannern (`fel`) flyttades samtidigt upp till direkt
 * under undertiteln så den syns oavsett om det var Spara eller Radera som
 * gick fel, utan att behöva scrolla.
 */
export default function RedigeraDrev() {
  const f = useFarger();
  const { jaktdagId, drevId, nystoppat } = useLocalSearchParams<{
    jaktdagId: string;
    drevId: string;
    nystoppat?: string;
  }>();
  const varNystoppat = nystoppat === "1";

  const [drev, setDrev] = useState<DrevMedHundnamn | null>(null);
  const [hundarPaJaktdagen, setHundarPaJaktdagen] = useState<Hund[]>([]);
  const [hundId, setHundId] = useState("");
  const [startTimestamp, setStartTimestamp] = useState(0);
  const [endTimestamp, setEndTimestamp] = useState(0);
  const [species, setSpecies] = useState("");
  const [outcome, setOutcome] = useState("");
  const [sparar, setSparar] = useState(false);
  const [raderar, setRaderar] = useState(false);
  const [visaRaderaBekraftelse, setVisaRaderaBekraftelse] = useState(false);
  const [fel, setFel] = useState<string | null>(null);
  // 2026-11-04: händelser, söktid, väder och fällt vilt för drevet.
  const [handelser, setHandelser] = useState<DrevHandelse[]>([]);
  const [sok, setSok] = useState<number | null>(null);
  const [vader, setVader] = useState<Vader | null>(null);
  const [fallt, setFallt] = useState<FalltVilt[]>([]);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;

      (async () => {
        const db = await getDatabase();
        const [d, hundar, dagensHandelser, dagensDrev, v, f] =
          await Promise.all([
            hamtaDrevMedHundnamn(db, drevId),
            hamtaHundarForJaktdag(db, jaktdagId),
            hamtaHandelserForJaktdag(db, jaktdagId),
            hamtaDrevMedHundnamnForJaktdag(db, jaktdagId),
            hamtaVaderForDrev(db, drevId),
            hamtaFalltViltForDrev(db, drevId),
          ]);
        if (avbruten) {
          return;
        }
        setHandelser(
          sorteraHandelser(dagensHandelser.filter((h) => h.drevId === drevId)),
        );
        setSok(d ? soktid(d, dagensHandelser, dagensDrev) : null);
        setVader(v);
        setFallt(f);
        if (d) {
          setDrev(d);
          setHundId(d.hundId);
          setStartTimestamp(d.startTimestamp);
          setEndTimestamp(d.endTimestamp ?? d.startTimestamp);
          setSpecies(d.species ?? "");
          setOutcome(d.outcome ?? "");
        }
        setHundarPaJaktdagen(hundar);
        setVisaRaderaBekraftelse(false);
        setFel(null);
      })();

      return () => {
        avbruten = true;
      };
    }, [drevId, jaktdagId]),
  );

  const tillbaka = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const duration = Math.max(0, endTimestamp - startTimestamp);
  const kanSpara = endTimestamp > startTimestamp;

  const spara = async () => {
    if (sparar || !kanSpara) {
      return;
    }
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      await uppdateraDrev(db, drevId, {
        hundId,
        startTimestamp,
        endTimestamp,
        species,
        outcome,
      });
      // Fälld och inget vilt registrerat än: fråga direkt om fällt vilt.
      if (outcome === UTFALL_FALLD && fallt.length === 0) {
        const art = encodeURIComponent(species);
        router.replace(
          `/jaktdag/${jaktdagId}/fallt/ny?drevId=${drevId}&art=${art}`,
        );
        return;
      }
      tillbaka();
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte spara drevet.");
      setSparar(false);
    }
  };

  const avbryt = () => {
    if (sparar) {
      return;
    }
    tillbaka();
  };

  const bekraftaRadering = async () => {
    if (raderar) {
      return;
    }
    setFel(null);
    setRaderar(true);
    try {
      const db = await getDatabase();
      await raderaDrev(db, drevId);
      tillbaka();
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte radera drevet.");
      setRaderar(false);
      setVisaRaderaBekraftelse(false);
    }
  };

  if (!drev) {
    return (
      <View style={[styles.laddar, { backgroundColor: f.surface100 }]}>
        <ActivityIndicator size="large" color={f.brand} />
      </View>
    );
  }

  const hundNamnNu =
    hundarPaJaktdagen.find((h) => h.id === hundId)?.namn ?? drev.hundNamn;
  const tappt = tapptTid(handelser, endTimestamp);
  const vaderRad = vaderText(vader);

  const taBortHandelse = async (id: string) => {
    const db = await getDatabase();
    await raderaHandelse(db, id);
    setHandelser((lista) => lista.filter((h) => h.id !== id));
  };

  return (
    <Skarm
      sidfot={
        <View style={styles.sidfot}>
          <Felrad
            text={!kanSpara ? "Sluttiden måste vara efter starttiden." : fel}
          />
          <Knapp
            titel="Spara"
            onPress={spara}
            laddar={sparar}
            disabled={!kanSpara}
          />
        </View>
      }
    >
      <View>
        <Txt variant="title1" accessibilityRole="header">
          {varNystoppat ? "Drevet stoppat" : "Redigera drev"}
        </Txt>
        <Txt variant="body" farg="inkMuted" style={styles.undertitel}>
          {hundNamnNu} · {formateraTid(duration)}
        </Txt>
        {vaderRad && (
          <Txt variant="caption" farg="inkMuted" style={styles.undertitel}>
            {vaderRad} · {VADER_KALLA}
          </Txt>
        )}
      </View>

      {!visaRaderaBekraftelse ? (
        <View style={styles.toppKnappar}>
          <Knapp
            titel={varNystoppat ? "Hoppa över" : "Avbryt"}
            variant="sekundar"
            onPress={avbryt}
            disabled={sparar}
          />
          <Knapp
            titel="Radera drev"
            variant="faraLiten"
            fullBredd
            onPress={() => setVisaRaderaBekraftelse(true)}
            laddar={raderar}
          />
        </View>
      ) : (
        <View style={styles.block}>
          <InlineBanner
            text="Det här drevet raderas permanent. Det går inte att ångra."
            typ="error"
          />
          <Knapp
            titel="Ja, radera permanent"
            variant="fara"
            onPress={bekraftaRadering}
            laddar={raderar}
          />
          <Knapp
            titel="Avbryt"
            variant="sekundar"
            onPress={() => setVisaRaderaBekraftelse(false)}
            disabled={raderar}
          />
        </View>
      )}

      {hundarPaJaktdagen.length > 1 && (
        <View>
          <Etikett>HUND</Etikett>
          <View style={styles.block}>
            {hundarPaJaktdagen.map((h) => (
              <SelectableCard
                key={h.id}
                titel={h.namn}
                vald={h.id === hundId}
                onPress={() => setHundId(h.id)}
                typ="radio"
              />
            ))}
          </View>
        </View>
      )}

      <ChipSelect
        label="Viltart"
        options={VILTARTER}
        value={species}
        onChange={setSpecies}
        egetTitel="Eget"
        egetLage="dialog"
        dialogRubrik="Eget vilt"
      />
      <ChipSelect
        label="Utfall"
        options={UTFALL}
        value={outcome}
        onChange={setOutcome}
      />
      {outcome !== UTFALL_FALLD && fallt.length > 0 && (
        <InlineBanner
          typ="info"
          text="Drevet har fällt vilt registrerat men utfallet är inte Fälld. Viltet ligger kvar tills du tar bort det."
        />
      )}
      <View>
        <Etikett>TID</Etikett>
        <TidVal
          start={startTimestamp}
          slut={endTimestamp}
          onStart={setStartTimestamp}
          onSlut={setEndTimestamp}
        />
      </View>

      {(handelser.length > 0 || sok !== null) && (
        <View>
          <Etikett>HÄNDELSER</Etikett>
          <Kort lista>
            {sok !== null && (
              <Listrad
                forsta
                titel="Söktid"
                undertitel="Från släpp till upptag"
                hoger={formateraVaraktighet(sok)}
              />
            )}
            <Listrad
              forsta={sok === null}
              titel="Upptag"
              hoger={klockslag(startTimestamp)}
            />
            {handelser.map((h) => (
              <Listrad
                key={h.id}
                titel={HANDELSE_NAMN[h.typ]}
                undertitel={klockslag(h.tidpunkt)}
                hoger="Ta bort"
                hogerFarg="signal"
                accessibilityLabel={`Ta bort ${HANDELSE_NAMN[h.typ]} ${klockslag(h.tidpunkt)}`}
                onPress={() => taBortHandelse(h.id)}
              />
            ))}
            <Listrad titel="Drevslut" hoger={klockslag(endTimestamp)} />
            {tappt > 0 && (
              <Listrad
                titel="Effektiv drevtid"
                undertitel={`Tappt totalt ${formateraVaraktighet(tappt)}`}
                hoger={formateraVaraktighet(Math.max(0, duration - tappt))}
              />
            )}
          </Kort>
        </View>
      )}

      <View>
        <Etikett>FÄLLT VILT</Etikett>
        {fallt.length > 0 && (
          <Kort lista>
            {fallt.map((v, i) => (
              <Listrad
                key={v.id}
                forsta={i === 0}
                titel={
                  v.antal > 1 ? `${v.art} ×${v.antal}` : v.art
                }
                undertitel={
                  [v.skytt, v.vikt ? `${v.vikt} kg` : null]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
                onPress={() =>
                  router.push(`/jaktdag/${jaktdagId}/fallt/${v.id}`)
                }
              />
            ))}
          </Kort>
        )}
        <Knapp
          variant="text"
          ikon="plus"
          titel="Lägg till fällt vilt"
          onPress={() =>
            router.push(
              `/jaktdag/${jaktdagId}/fallt/ny?drevId=${drevId}&art=${encodeURIComponent(species)}`,
            )
          }
        />
      </View>

      {Platform.OS !== "web" && drev.endTimestamp !== null && (
        <Knapp
          variant="sekundar"
          ikon="dela"
          titel="Dela som bild"
          onPress={() => router.push(`/dela?typ=drev&id=${drevId}`)}
        />
      )}
    </Skarm>
  );
}

const styles = StyleSheet.create({
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  undertitel: { marginTop: avstand.s1 },
  // Hoppa över/Avbryt överst, Radera drev på raden under - båda i full
  // bredd, Radera drev med halv höjd (Filip 2026-10-10).
  toppKnappar: { gap: avstand.s3 },
  block: { gap: avstand.s2 },
  sidfot: { gap: avstand.s2 },
});
