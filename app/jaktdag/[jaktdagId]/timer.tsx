import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaJaktdag, settAktivHund } from "@/db/queries/jaktdag";
import { hamtaHundarForJaktdag } from "@/db/queries/hund";
import {
  hamtaPagaendeDrev,
  hamtaSenasteDrev,
  startaDrev,
  stoppaDrev,
} from "@/db/queries/drev";
import type { Drev, Hund, Jaktdag } from "@/db/types";
import { SelectableCard } from "@/components/SelectableCard";
import { TimerDisplay } from "@/components/TimerDisplay";
import { useElapsedTime, formateraTid } from "@/hooks/useElapsedTime";
import {
  doljDrevPaLasskarm,
  synkaLasskarm,
  visaDrevPaLasskarm,
} from "@/liveActivity";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hamtaDrevMedHundnamnForJaktdag } from "@/db/queries/statistik";
import { TimerTemaOmrade, useFarger, useTema } from "@/theme/TemaContext";
import { avstand, radie, tryck } from "@/theme/tokens";
import { Knapp } from "@/components/ui/Knapp";
import { Felrad, TillbakaKnapp } from "@/components/ui/Delar";
import { Ikon } from "@/components/ui/Ikon";
import { Txt } from "@/components/ui/Txt";

/**
 * Sida 3: Starta/stoppa timer. Robust mot att appen dödas/backgroundas
 * mitt i ett drev - vid mount hämtas ett ev. pågående drev direkt från
 * databasen (hamtaPagaendeDrev), inte från något sparat JS-state. Den
 * synliga klockan (useElapsedTime) räknar bara om `nu - startTimestamp`
 * varje sekund; startTimestamp är källan till sanning.
 *
 * Sprint 3: när ett drev stoppas navigeras man direkt vidare till
 * app/jaktdag/[jaktdagId]/drev/[drevId].tsx (med query-param
 * `?nystoppat=1`) för att (valfritt) välja viltart/utfall - se stopp()
 * nedan. Den vyn har egna Spara/Hoppa över-knappar (beslutat 2026-08-29,
 * ersätter ett tidigare försök med spara-direkt-chips direkt här på
 * timern) och kan numera även nås från historiken för att redigera/radera
 * ett äldre drev - `nystoppat`-flaggan styr bara rubrik/knapptext där, se
 * den skärmens egen kommentar. `senasteDrev` hämtas ändå kvar vid
 * mount/fokus (hamtaSenasteDrev()) bara för att visa "Senaste drevet:
 * mm:ss" på timern - ingen inmatning kvar här.
 *
 * 2026-09-08: `ScreenHeader` satt utanför `scrollInnehall` (för att den
 * inte ska scrolla bort) men `styles.container` som håller den saknade
 * `paddingHorizontal` - "‹ Tillbaka"/jaktmark/datum satt då helt utan
 * sidoinset, till skillnad från samma header på Välj hundar/historikens
 * detaljvy där den ligger inuti en redan padda ScrollView. Löst genom att
 * flytta det horisontella insetet till `container` (gäller nu både
 * headern och scrollinnehållet) istället för att bara ha det på
 * `scrollInnehall` - synligt totalt inset oförändrat för allt under
 * headern.
 *
 * 2026-10-09: drevklockan speglas på låsskärmen (iOS Live Activity) via
 * src/liveActivity.ts - startas efter startaDrev(), avslutas efter
 * stoppaDrev(), och synkas mot databasen vid varje fokus. Alla anrop är
 * fire-and-forget efter att databasskrivningen redan lyckats.
 *
 * Sprint 6 (designlyftet): fältläge enligt Design Systemet. Hund, tid och
 * EN knapp (Starta/Stoppa drev, 112 px hög, ord + ikon). Stor Tillbaka
 * uppe till vänster, tema-knapp uppe till höger som bara gäller timern
 * (TimerTemaOmrade - följer appens tema tills man tryckt, sparas separat).
 * "Avsluta jaktdag" finns inte längre här utan på Hem. "Byt hund" finns
 * kvar som en liten textknapp under hundnamnet, bara mellan två drev.
 */
export default function Timer() {
  const { jaktdagId } = useLocalSearchParams<{ jaktdagId: string }>();

  const [jaktdag, setJaktdag] = useState<Jaktdag | null>(null);
  const [hundarPaJaktdagen, setHundarPaJaktdagen] = useState<Hund[]>([]);
  const [pagaendeDrev, setPagaendeDrev] = useState<Drev | null>(null);
  const [senasteDrev, setSenasteDrev] = useState<Drev | null>(null);
  const [visaBytHund, setVisaBytHund] = useState(false);
  const [laddat, setLaddat] = useState(false);
  const [antalDrev, setAntalDrev] = useState(0);
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  // Hämtar om vid varje fokus, inte bara vid montering - se motivering i
  // app/index.tsx. Här betyder det bland annat att hundlistan för
  // byt-hund-läget är färsk om man t.ex. lagt till en hund på jaktdagen
  // från ett annat håll medan man var borta från timern.
  // Ökas när appen kommer tillbaka till förgrunden, så att laddningen
  // nedan körs om. Behövs för stoppknappen på låsskärmen: den stoppar
  // drevet direkt i databasen medan appen ligger i bakgrunden, och
  // useFocusEffect körs inte av att appen bara aktiveras igen.
  const [forgrundRunda, setForgrundRunda] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setForgrundRunda((n) => n + 1);
      }
    });
    return () => sub.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;

      (async () => {
        const db = await getDatabase();
        const [j, hundar, drev, senaste, allaDrev] = await Promise.all([
          hamtaJaktdag(db, jaktdagId),
          hamtaHundarForJaktdag(db, jaktdagId),
          hamtaPagaendeDrev(db, jaktdagId),
          hamtaSenasteDrev(db, jaktdagId),
          hamtaDrevMedHundnamnForJaktdag(db, jaktdagId),
        ]);
        if (!avbruten) {
          setJaktdag(j);
          setHundarPaJaktdagen(hundar);
          setPagaendeDrev(drev);
          setSenasteDrev(
            !drev && senaste && senaste.endTimestamp !== null ? senaste : null,
          );
          setAntalDrev(allaDrev.length);
          setLaddat(true);
          // Låsskärmen (Live Activity) ska spegla databasen - se
          // src/liveActivity.ts. Väntas inte in: får aldrig blockera timern.
          const drevHund = drev ? hundar.find((h) => h.id === drev.hundId) : undefined;
          void synkaLasskarm(
            drev,
            j && drevHund ? { jaktmark: j.jaktmark, hundNamn: drevHund.namn } : undefined,
          );
        }
      })();

      return () => {
        avbruten = true;
      };
      // forgrundRunda används inte i kroppen - den finns med just för att
      // trigga omladdning när appen aktiveras (se ovan).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jaktdagId, forgrundRunda]),
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
      setAntalDrev((n) => n + 1);
      if (jaktdag) {
        void visaDrevPaLasskarm({
          drevId: drev.id,
          jaktmark: jaktdag.jaktmark,
          hundNamn: aktivHund.namn,
          startTimestamp: drev.startTimestamp,
        });
      }
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
      void doljDrevPaLasskarm();
      router.push(`/jaktdag/${jaktdagId}/drev/${avslutatDrev.id}?nystoppat=1`);
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

  if (!laddat || !jaktdag) {
    return (
      <TimerTemaOmrade>
        <Laddar />
      </TimerTemaOmrade>
    );
  }

  const drevNummer = pagaendeDrev ? antalDrev : antalDrev + 1;

  return (
    <TimerTemaOmrade>
      <TimerVy
        hundNamn={aktivHund?.namn ?? "Ingen hund vald"}
        kontext={`${jaktdag.jaktmark} · Drev ${drevNummer}`}
        sekunder={elapsed}
        pagar={pagaendeDrev !== null}
        senasteDrevTid={senasteDrev && !pagaendeDrev ? formateraTid(senasteDrev.duration ?? 0) : null}
        kanStarta={!!aktivHund}
        sparar={sparar}
        fel={fel}
        onStart={start}
        onStopp={stopp}
        bytHund={
          hundarPaJaktdagen.length > 1 && !pagaendeDrev
            ? {
                visa: visaBytHund,
                vaxla: () => setVisaBytHund((v) => !v),
                hundar: hundarPaJaktdagen,
                aktivId: jaktdag.aktivHundId,
                valj: bytAktivHund,
              }
            : null
        }
      />
    </TimerTemaOmrade>
  );
}

function Laddar() {
  const f = useFarger();
  return (
    <View style={[styles.laddar, { backgroundColor: f.surface100 }]}>
      <ActivityIndicator size="large" color={f.brand} />
    </View>
  );
}

/**
 * Själva fältläget, ritat inom TimerTemaOmrade så att alla färger kommer
 * från timerns eget tema. Tre element enligt Design Systemet (TimerPanel):
 * hund + jaktmark/drevnummer överst, drevtiden i mitten och en enda stor
 * knapp längst ner. Stor Tillbaka uppe till vänster, tema-knapp uppe till
 * höger (gäller bara timern).
 */
function TimerVy(props: {
  hundNamn: string;
  kontext: string;
  sekunder: number;
  pagar: boolean;
  senasteDrevTid: string | null;
  kanStarta: boolean;
  sparar: boolean;
  fel: string | null;
  onStart: () => void;
  onStopp: () => void;
  bytHund: {
    visa: boolean;
    vaxla: () => void;
    hundar: Hund[];
    aktivId: string | null;
    valj: (id: string) => void;
  } | null;
}) {
  const { farger, schema, setTimerTemaVal } = useTema();
  const insets = useSafeAreaInsets();
  const mork = schema === "dark";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: farger.surface100,
          paddingTop: insets.top + avstand.s4,
          paddingBottom: Math.max(insets.bottom, avstand.s4) + avstand.s4,
        },
      ]}
    >
      <StatusBar style={mork ? "light" : "dark"} />
      <View style={styles.topprad}>
        <TillbakaKnapp />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mork ? "Byt timern till ljust tema" : "Byt timern till mörkt tema"}
          onPress={() => setTimerTemaVal(mork ? "ljust" : "morkt")}
          style={({ pressed }) => [
            styles.temaKnapp,
            { backgroundColor: farger.surface300, opacity: pressed ? 0.82 : 1 },
          ]}
        >
          <Ikon namn={mork ? "sol" : "mane"} farg={farger.ink} />
          <Txt variant="button">{mork ? "Ljust" : "Mörkt"}</Txt>
        </Pressable>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.mitten}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hundBlock}>
          <Txt variant="title2" style={styles.center}>
            {props.hundNamn}
          </Txt>
          <Txt variant="caption" farg="inkMuted" style={styles.center}>
            {props.kontext}
          </Txt>
          {props.bytHund && (
            <Knapp
              variant="text"
              titel={props.bytHund.visa ? "Avbryt hundbyte" : "Byt hund"}
              onPress={props.bytHund.vaxla}
              style={styles.bytHund}
            />
          )}
        </View>

        {props.bytHund?.visa && (
          <View style={styles.hundlista}>
            {props.bytHund.hundar.map((h) => (
              <SelectableCard
                key={h.id}
                typ="radio"
                titel={h.namn}
                vald={h.id === props.bytHund?.aktivId}
                onPress={() => props.bytHund?.valj(h.id)}
              />
            ))}
          </View>
        )}

        <TimerDisplay sekunder={props.sekunder} pagar={props.pagar} />

        {props.senasteDrevTid && (
          <Txt variant="caption" farg="inkMuted" style={styles.center}>
            Senaste drevet: {props.senasteDrevTid}
          </Txt>
        )}

        <Felrad text={props.fel} />
      </ScrollView>

      {props.pagar ? (
        <Knapp variant="stopp" ikon="stopp" titel="Stoppa drev" onPress={props.onStopp} laddar={props.sparar} minHojd={112} />
      ) : (
        <Knapp
          variant="start"
          ikon="spela"
          titel="Starta drev"
          onPress={props.onStart}
          disabled={!props.kanStarta}
          laddar={props.sparar}
          minHojd={112}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { flex: 1, paddingHorizontal: avstand.s4, gap: avstand.s4 },
  topprad: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  temaKnapp: {
    flexDirection: "row",
    alignItems: "center",
    gap: avstand.s2,
    minHeight: tryck.min,
    paddingLeft: avstand.s4,
    paddingRight: 20,
    borderRadius: radie.md,
  },
  mitten: { flexGrow: 1, justifyContent: "center", alignItems: "stretch", gap: avstand.s4 },
  hundBlock: { alignItems: "center", gap: avstand.s1 },
  bytHund: { alignSelf: "center" },
  hundlista: { gap: avstand.s2 },
  center: { textAlign: "center" },
});
