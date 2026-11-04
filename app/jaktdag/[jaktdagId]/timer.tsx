import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
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
import type {
  Drev,
  DrevHandelse,
  DrevMedHundnamn,
  HandelseTyp,
  Hund,
  Jaktdag,
  Vader,
} from "@/db/types";
import {
  hamtaHandelserForJaktdag,
  registreraHandelse,
} from "@/db/queries/handelse";
import { hamtaVaderForDrev } from "@/db/queries/vader";
import { oppenTappt, sokerSedan, tapptTid } from "@/utils/drevhandelser";
import { foreNamn, vaderText, vadretsKo } from "@/utils/vader";
import { InlineBanner } from "@/components/InlineBanner";
import { SelectableCard } from "@/components/SelectableCard";
import { TimerDisplay } from "@/components/TimerDisplay";
import { useElapsedTime, formateraTid } from "@/hooks/useElapsedTime";
import { synkaLasskarm } from "@/liveActivity";
import { useProfil } from "@/contexts/ProfilContext";
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
  const { profil } = useProfil();

  const [jaktdag, setJaktdag] = useState<Jaktdag | null>(null);
  const [hundarPaJaktdagen, setHundarPaJaktdagen] = useState<Hund[]>([]);
  const [pagaendeDrev, setPagaendeDrev] = useState<Drev | null>(null);
  const [senasteDrev, setSenasteDrev] = useState<Drev | null>(null);
  const [visaBytHund, setVisaBytHund] = useState(false);
  const [laddat, setLaddat] = useState(false);
  const [antalDrev, setAntalDrev] = useState(0);
  // 2026-11-04: drevhändelser (släpp/tappt/återupptag/kopplad), dagens
  // drev (för söktid) och vädret vid senaste drevstart.
  const [handelser, setHandelser] = useState<DrevHandelse[]>([]);
  const [dagensDrev, setDagensDrev] = useState<DrevMedHundnamn[]>([]);
  const [vader, setVader] = useState<Vader | null>(null);
  const [fragaSlut, setFragaSlut] = useState(false);
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
        const [j, hundar, drev, senaste, allaDrev, h] = await Promise.all([
          hamtaJaktdag(db, jaktdagId),
          hamtaHundarForJaktdag(db, jaktdagId),
          hamtaPagaendeDrev(db, jaktdagId),
          hamtaSenasteDrev(db, jaktdagId),
          hamtaDrevMedHundnamnForJaktdag(db, jaktdagId),
          hamtaHandelserForJaktdag(db, jaktdagId),
        ]);
        const v = senaste ? await hamtaVaderForDrev(db, senaste.id) : null;
        if (!avbruten) {
          setHandelser(h);
          setDagensDrev(allaDrev);
          setVader(v);
          setFragaSlut(false);
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
          void synkaLasskarm(profil.id);
          // Väder för drev som saknar det (inget nät vid drevstart).
          if (j) {
            void vadretsKo(db, jaktdagId, j.jaktmarkId).then(async () => {
              const ny = senaste
                ? await hamtaVaderForDrev(db, senaste.id)
                : null;
              if (!avbruten && ny) setVader(ny);
            });
          }
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

  const aktivHund = hundarPaJaktdagen.find(
    (h) => h.id === jaktdag?.aktivHundId,
  );

  // Drevhändelser (2026-11-04). Hooks före tidiga return nedan.
  const drevHandelser = pagaendeDrev
    ? handelser.filter((h) => h.drevId === pagaendeDrev.id)
    : [];
  const tapptSedan = pagaendeDrev ? oppenTappt(drevHandelser) : null;
  const senasteSlutForHund = aktivHund
    ? dagensDrev
        .filter((d) => d.hundId === aktivHund.id && d.endTimestamp !== null)
        .reduce<number | null>(
          (max, d) => Math.max(max ?? 0, d.endTimestamp ?? 0),
          null,
        )
    : null;
  const sokerFran =
    !pagaendeDrev && aktivHund
      ? sokerSedan(aktivHund.id, handelser, senasteSlutForHund)
      : null;
  const sokSekunder = useElapsedTime(sokerFran);
  const tapptNu = useElapsedTime(tapptSedan);
  const tapptTotalt = pagaendeDrev ? tapptTid(drevHandelser, null) : 0;

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
      setDagensDrev((lista) => [
        ...lista,
        { ...drev, hundNamn: aktivHund.namn },
      ]);
      void synkaLasskarm(profil.id);
      if (jaktdag) {
        // Fire-and-forget: får aldrig blockera timern.
        void vadretsKo(db, jaktdagId, jaktdag.jaktmarkId).then(async () => {
          setVader(await hamtaVaderForDrev(db, drev.id));
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

  const stopp = async (vidTappt?: number) => {
    if (!pagaendeDrev || sparar) {
      return;
    }
    // Står drevet i tappt: fråga först om drevet slutade vid tappten.
    if (vidTappt === undefined && tapptSedan !== null && !fragaSlut) {
      setFragaSlut(true);
      return;
    }
    setFragaSlut(false);
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      const avslutatDrev = await stoppaDrev(db, pagaendeDrev.id, vidTappt);
      setSenasteDrev(avslutatDrev);
      setPagaendeDrev(null);
      void synkaLasskarm(profil.id);
      router.push(`/jaktdag/${jaktdagId}/drev/${avslutatDrev.id}?nystoppat=1`);
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte stoppa drevet.");
    } finally {
      setSparar(false);
    }
  };

  const registrera = async (typ: HandelseTyp) => {
    if (!aktivHund || sparar) {
      return;
    }
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      const drevId =
        typ === "tappt" || typ === "atertag"
          ? (pagaendeDrev?.id ?? null)
          : null;
      const hundId = pagaendeDrev?.hundId ?? aktivHund.id;
      const ny = await registreraHandelse(db, {
        jaktdagId,
        hundId,
        drevId,
        typ,
      });
      setHandelser((lista) => [...lista, ny]);
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte spara.");
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
      void synkaLasskarm(profil.id);
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
        senasteDrevTid={
          senasteDrev && !pagaendeDrev
            ? formateraTid(senasteDrev.duration ?? 0)
            : null
        }
        kanStarta={!!aktivHund}
        sparar={sparar}
        fel={fel}
        onStart={start}
        onStopp={() => stopp()}
        status={
          tapptSedan !== null
            ? `Tappt ${formateraTid(tapptNu)}`
            : pagaendeDrev && tapptTotalt > 0
              ? `Tappt totalt ${formateraTid(tapptTotalt)}`
              : sokerFran !== null
                ? `Söker ${formateraTid(sokSekunder)}`
                : null
        }
        vaderRad={
          [vaderText(vader), foreNamn(jaktdag.fore)]
            .filter(Boolean)
            .join(" · ") || null
        }
        handelse={
          fragaSlut && tapptSedan !== null
            ? {
                typ: "fragaSlut",
                tapptKlockslag: new Date(tapptSedan * 1000).toLocaleTimeString(
                  "sv-SE",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                ),
                vidTappt: () => stopp(tapptSedan),
                nu: () => stopp(Math.floor(Date.now() / 1000)),
                avbryt: () => setFragaSlut(false),
              }
            : pagaendeDrev
              ? {
                  typ: "drev",
                  iTappt: tapptSedan !== null,
                  onTappt: () =>
                    registrera(tapptSedan !== null ? "atertag" : "tappt"),
                }
              : aktivHund
                ? {
                    typ: "vila",
                    soker: sokerFran !== null,
                    onSlapp: () => registrera("slapp"),
                    onKopplad: () => registrera("kopplad"),
                  }
                : null
        }
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

/** Knapparna för drevhändelser, beroende på läge (2026-11-04). */
type HandelseKnappar =
  | { typ: "vila"; soker: boolean; onSlapp: () => void; onKopplad: () => void }
  | { typ: "drev"; iTappt: boolean; onTappt: () => void }
  | {
      typ: "fragaSlut";
      tapptKlockslag: string;
      vidTappt: () => void;
      nu: () => void;
      avbryt: () => void;
    };

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
  status: string | null;
  vaderRad: string | null;
  handelse: HandelseKnappar | null;
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
          accessibilityLabel={
            mork ? "Byt timern till ljust tema" : "Byt timern till mörkt tema"
          }
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

        <TimerDisplay
          sekunder={props.sekunder}
          pagar={props.pagar}
          status={props.status}
        />

        {props.vaderRad && (
          <Txt variant="caption" farg="inkMuted" style={styles.center}>
            {props.vaderRad}
          </Txt>
        )}

        {props.senasteDrevTid && (
          <Txt variant="caption" farg="inkMuted" style={styles.center}>
            Senaste drevet: {props.senasteDrevTid}
          </Txt>
        )}

        <Felrad text={props.fel} />
      </ScrollView>

      {props.handelse?.typ === "fragaSlut" ? (
        <View style={styles.knappar}>
          <InlineBanner
            typ="info"
            text={`Drevet står i tappt sedan ${props.handelse.tapptKlockslag}. Slutade drevet vid tappten?`}
          />
          <Knapp
            variant="stopp"
            titel={`Ja, slutade ${props.handelse.tapptKlockslag}`}
            onPress={props.handelse.vidTappt}
            laddar={props.sparar}
            minHojd={80}
          />
          <Knapp
            variant="sekundar"
            titel="Nej, stoppa nu"
            onPress={props.handelse.nu}
            disabled={props.sparar}
            minHojd={64}
          />
          <Knapp
            variant="text"
            titel="Avbryt"
            onPress={props.handelse.avbryt}
            style={styles.bytHund}
          />
        </View>
      ) : props.pagar ? (
        <View style={styles.knappar}>
          {props.handelse?.typ === "drev" && (
            <Knapp
              variant={props.handelse.iTappt ? "primar" : "sekundar"}
              titel={props.handelse.iTappt ? "Tog upp igen" : "Tappt"}
              onPress={props.handelse.onTappt}
              disabled={props.sparar}
              minHojd={80}
            />
          )}
          <Knapp
            variant="stopp"
            ikon="stopp"
            titel="Stoppa drev"
            onPress={props.onStopp}
            laddar={props.sparar}
            minHojd={112}
          />
        </View>
      ) : (
        <View style={styles.knappar}>
          {props.handelse?.typ === "vila" &&
            (props.handelse.soker ? (
              <Knapp
                variant="sekundar"
                titel="Kopplad"
                onPress={props.handelse.onKopplad}
                disabled={props.sparar}
                minHojd={64}
              />
            ) : (
              <Knapp
                variant="sekundar"
                titel="Släppt"
                onPress={props.handelse.onSlapp}
                disabled={props.sparar}
                minHojd={64}
              />
            ))}
          <Knapp
            variant="start"
            ikon="spela"
            titel="Starta drev"
            onPress={props.onStart}
            disabled={!props.kanStarta}
            laddar={props.sparar}
            minHojd={112}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { flex: 1, paddingHorizontal: avstand.s4, gap: avstand.s4 },
  topprad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  temaKnapp: {
    flexDirection: "row",
    alignItems: "center",
    gap: avstand.s2,
    minHeight: tryck.min,
    paddingLeft: avstand.s4,
    paddingRight: 20,
    borderRadius: radie.md,
  },
  mitten: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "stretch",
    gap: avstand.s4,
  },
  hundBlock: { alignItems: "center", gap: avstand.s1 },
  bytHund: { alignSelf: "center" },
  hundlista: { gap: avstand.s2 },
  knappar: { gap: avstand.s3 },
  center: { textAlign: "center" },
});
