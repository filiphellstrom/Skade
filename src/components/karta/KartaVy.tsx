import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import MapView from "react-native-maps";
import type {
  MapPressEvent,
  MapType,
  Region,
  UserLocationChangeEvent,
} from "react-native-maps";
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaKartdata } from "@/db/queries/kartpunkt";
import type { Kartdata } from "@/db/queries/kartpunkt";
import { hamtaPagaendeJaktdag } from "@/db/queries/jaktdag";
import type { Kartpunkt } from "@/db/types";
import { useProfil } from "@/contexts/ProfilContext";
import { omradeFor, omradetsBredd } from "@/vind/geo";
import type { LatLon } from "@/vind/geo";
import { arPass, kategoriNamn } from "@/vind/gpx";
import { byggPil, narmaste, pilplatser, provpunkter } from "@/vind/pilar";
import type { Vindpil } from "@/vind/pilar";
import {
  narmasteTid,
  prognosTimmar,
  riktningsskifte,
  stegVid,
  valbaraTider,
} from "@/vind/prognos";
import { beraknaVittringszon } from "@/vind/vittring";
import {
  GransLager,
  JagareMarkor,
  PilLager,
  PunktMarkor,
  ZonLager,
} from "./vind/Kartlager";
import { BREDDVAL, VindPanel } from "./vind/VindPanel";
import type { Langdval } from "./vind/VindPanel";
import { punktNyckel, useVindprognoser } from "./vind/useVindprognoser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ikon } from "@/components/ui/Ikon";
import type { IkonNamn } from "@/components/ui/Ikon";
import { Knapp } from "@/components/ui/Knapp";
import { Txt } from "@/components/ui/Txt";
import { useTema } from "@/theme/TemaContext";
import { avstand, radie, tryck } from "@/theme/tokens";
import {
  formateraKlocka,
  formateraSoltid,
  nastaSolhandelse,
  solDagEtikett,
} from "@/utils/sol";

/**
 * Kartfliken i iPhone-appen (steg 1): Apple Maps via react-native-maps,
 * bara den egna positionen. Ingen data sparas.
 *
 * - Platsbehörigheten ("när appen används", samma som vädret från SMHI)
 *   frågas när fliken öppnas, aldrig vid appstart. Nekad: förklaring +
 *   knapp till Inställningar. Kollas om när fliken får fokus och när
 *   appen kommer tillbaka, så att ett ja i Inställningar märks direkt.
 * - Kartan centreras på positionen vid första positionen efter att
 *   fliken öppnats, och med Min position.
 * - Positionen (GPS) fungerar utan täckning. Kartbilden från Apple gör
 *   det bara där den redan finns i cacheminnet. Offlinekarta är ett
 *   senare steg (t.ex. Lantmäteriets terrängkarta som UrlTile).
 * - Nästa soluppgång eller solnedgång (vilken som kommer först) visas
 *   till höger i positionsrutan, uträknad i telefonen ur GPS-positionen
 *   (src/utils/sol.ts) - fungerar alltså utan täckning.
 * - Vind och vittring (2026-11-06): jaktmarkernas gräns och markeringar
 *   (importerade från GPX) visas alltid. Knappen "Vind" slår på
 *   vindpilar, vittringszon och prognospanelen. Beräkningarna ligger i
 *   src/vind/ (testade), lagren i ./vind/.
 */

/** Pilar visas bara när kartan visar mindre än så här (meter i bredd). */
const MAX_BREDD_FOR_PILAR = 80000;
/** Namn på pass och torn visas när kartan är smalare än så här. */
const MAX_BREDD_FOR_NAMN = 3500;

interface ValdPosition {
  pos: LatLon;
  namn: string;
  punktId?: string;
}

type Behorighet = "laddar" | "ok" | "nekad";

/** Hela Sverige, innan positionen är känd. */
const SVERIGE: Region = {
  latitude: 62.5,
  longitude: 16.5,
  latitudeDelta: 14,
  longitudeDelta: 14,
};

/** Ungefär 2 km över skärmen - lagom för att se terrängen runt sig. */
const NARA = 0.02;

interface Position {
  latitude: number;
  longitude: number;
  /** Noggrannhet i meter (radie), om iOS anger den. */
  noggrannhet: number | null;
}

/** 59.329301 → "59,32930° N", 5 decimaler ≈ 1 m. */
export function formateraKoordinat(varde: number, axel: "lat" | "lon"): string {
  const riktning =
    axel === "lat" ? (varde >= 0 ? "N" : "S") : varde >= 0 ? "Ö" : "V";
  return `${Math.abs(varde).toFixed(5).replace(".", ",")}° ${riktning}`;
}

export function KartaVy() {
  const { farger, schema, kortSkugga } = useTema();
  const insets = useSafeAreaInsets();
  const karta = useRef<MapView>(null);
  const harCentrerat = useRef(false);

  const [behorighet, setBehorighet] = useState<Behorighet>("laddar");
  const [position, setPosition] = useState<Position | null>(null);
  const [kartTyp, setKartTyp] = useState<MapType>("standard");
  const [nu, setNu] = useState(() => new Date());

  // --- Vind och vittring ---
  const { profil } = useProfil();
  const { jaktmark: jaktmarkParam } = useLocalSearchParams<{ jaktmark?: string }>();
  const { height: skarmHojd } = useWindowDimensions();
  const [kartdata, setKartdata] = useState<Kartdata[]>([]);
  const [koppling, setKoppling] = useState<{ jaktdagId: string | null; jaktmarkId: string | null }>({
    jaktdagId: null,
    jaktmarkId: null,
  });
  const [vindPa, setVindPa] = useState(false);
  const [panelOppen, setPanelOppen] = useState(false);
  const [omrade, setOmrade] = useState<Region>(SVERIGE);
  const [vald, setVald] = useState<ValdPosition | null>(null);
  const [valdTid, setValdTid] = useState<number | null>(null);
  const [zonPa, setZonPa] = useState(true);
  const [langd, setLangd] = useState<Langdval>("auto");
  const [bredd, setBredd] = useState<"smal" | "normal" | "bred">("normal");
  const [forsok, setForsok] = useState(0);
  const hanteradParam = useRef<string | null>(null);

  // Klockan för solhändelsen: räkna om varje halv minut, så att
  // "uppgång" byts mot "nedgång" i tid.
  useEffect(() => {
    const id = setInterval(() => setNu(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // Avrundat till ~1 km: solen ändras inte märkbart på kortare avstånd,
  // och då räknas inte allt om vid varje GPS-uppdatering.
  const solLat = position ? Math.round(position.latitude * 100) / 100 : null;
  const solLon = position ? Math.round(position.longitude * 100) / 100 : null;
  const solHandelse = useMemo(
    () =>
      solLat !== null && solLon !== null
        ? nastaSolhandelse(nu, solLat, solLon)
        : null,
    [nu, solLat, solLon],
  );

  const kollaBehorighet = useCallback(async (fraga: boolean) => {
    try {
      let svar = await Location.getForegroundPermissionsAsync();
      if (!svar.granted && svar.canAskAgain && fraga) {
        svar = await Location.requestForegroundPermissionsAsync();
      }
      setBehorighet(svar.granted ? "ok" : "nekad");
    } catch {
      setBehorighet("nekad");
    }
  }, []);

  // Fliken får fokus: fråga om behörigheten om den inte är bestämd.
  useFocusEffect(
    useCallback(() => {
      void kollaBehorighet(true);
    }, [kollaBehorighet]),
  );

  // Kartdata (gräns och markeringar) och pågående jaktdag, vid fokus.
  useFocusEffect(
    useCallback(() => {
      let avbruten = false;
      (async () => {
        const db = await getDatabase();
        const data = await hamtaKartdata(db, profil.id);
        const pagaende = await hamtaPagaendeJaktdag(db, profil.id);
        if (avbruten) return;
        setKartdata(data);
        setKoppling({
          jaktdagId: pagaende?.id ?? null,
          jaktmarkId: pagaende?.jaktmarkId ?? null,
        });
      })();
      return () => {
        avbruten = true;
      };
    }, [profil.id]),
  );

  // Tillbaka från Inställningar: kolla igen, men fråga inte.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (lage) => {
      if (lage === "active") void kollaBehorighet(false);
    });
    return () => sub.remove();
  }, [kollaBehorighet]);

  const centrera = useCallback((lat: number, lon: number) => {
    karta.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lon,
        latitudeDelta: NARA,
        longitudeDelta: NARA,
      },
      600,
    );
  }, []);

  const onPositionAndras = useCallback(
    (e: UserLocationChangeEvent) => {
      const k = e.nativeEvent.coordinate;
      if (!k) return;
      const noggrannhet =
        typeof k.accuracy === "number" && k.accuracy >= 0 ? k.accuracy : null;
      setPosition({
        latitude: k.latitude,
        longitude: k.longitude,
        noggrannhet,
      });
      if (!harCentrerat.current) {
        harCentrerat.current = true;
        centrera(k.latitude, k.longitude);
      }
    },
    [centrera],
  );

  const minPosition = useCallback(async () => {
    if (position) {
      centrera(position.latitude, position.longitude);
      return;
    }
    // Kartan har inte fått någon position än - be iOS om en direkt.
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      centrera(pos.coords.latitude, pos.coords.longitude);
    } catch {
      // Ingen position just nu (t.ex. inomhus). Rutan visar "Söker position".
    }
  }, [position, centrera]);

  // --- Vind och vittring: beräkningar ---------------------------------

  const visaJaktmark = useCallback(
    (id?: string | null) => {
      const data = kartdata.find((k) => k.jaktmark.id === id) ?? kartdata[0];
      if (!data) return;
      const o = omradeFor([
        ...data.grans,
        ...data.punkter.map((p) => ({ latitude: p.lat, longitude: p.lon })),
      ]);
      if (o) {
        harCentrerat.current = true;
        karta.current?.animateToRegion(o, 600);
      }
    },
    [kartdata],
  );

  // "Visa på kartan" från jaktmarkens sida: zooma till marken och slå på vinden.
  useEffect(() => {
    if (!jaktmarkParam || hanteradParam.current === jaktmarkParam) return;
    if (!kartdata.some((k) => k.jaktmark.id === jaktmarkParam)) return;
    hanteradParam.current = jaktmarkParam;
    setVindPa(true);
    visaJaktmark(jaktmarkParam);
  }, [jaktmarkParam, kartdata, visaJaktmark]);

  const gpsLat = position?.latitude ?? null;
  const gpsLon = position?.longitude ?? null;
  const gpsPosition = useMemo<LatLon | null>(
    () => (gpsLat !== null && gpsLon !== null ? { latitude: gpsLat, longitude: gpsLon } : null),
    [gpsLat, gpsLon],
  );
  const aktiv = useMemo<ValdPosition | null>(
    () => vald ?? (gpsPosition ? { pos: gpsPosition, namn: "Min position" } : null),
    [vald, gpsPosition],
  );

  const breddMeter = omradetsBredd(omrade);
  const visaPilar = vindPa && breddMeter < MAX_BREDD_FOR_PILAR;
  // Avrundat område, så att små panoreringar inte hämtar om prognoser.
  const provNyckel = visaPilar
    ? [omrade.latitude, omrade.longitude, omrade.latitudeDelta, omrade.longitudeDelta]
        .map((v) => Math.round(v * 100))
        .join(",")
    : "";
  const prov = useMemo(() => {
    if (!provNyckel) return [];
    const [la, lo, dla, dlo] = provNyckel.split(",").map((v) => Number(v) / 100);
    return provpunkter({ latitude: la, longitude: lo, latitudeDelta: dla, longitudeDelta: dlo });
  }, [provNyckel]);
  const aktivNyckel = aktiv ? punktNyckel(aktiv.pos.latitude, aktiv.pos.longitude) : null;
  const nycklar = useMemo(() => {
    if (!vindPa) return [];
    const k = prov.map((p) => punktNyckel(p.lat, p.lon));
    if (aktivNyckel) k.push(aktivNyckel);
    return k;
  }, [vindPa, prov, aktivNyckel]);
  const prognoser = useVindprognoser(nycklar, koppling, forsok);
  const aktivData = aktivNyckel ? prognoser[aktivNyckel] : undefined;
  const aktivPrognos = aktivData?.prognos ?? null;

  const nuSek = Math.floor(nu.getTime() / 1000);
  const tider = useMemo(() => {
    const kalla =
      aktivPrognos ?? Object.values(prognoser).find((p) => p.prognos)?.prognos ?? null;
    return valbaraTider(kalla, nuSek);
    // Räkna om när timmen byts, inte varje halvminut.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktivPrognos, prognoser, Math.floor(nuSek / 3600)]);
  const tid =
    valdTid !== null && tider.includes(valdTid) ? valdTid : narmasteTid(tider, nuSek);

  const aktivSteg = tid !== null ? stegVid(aktivPrognos, tid) : null;

  const pilar = useMemo<Vindpil[]>(() => {
    if (!visaPilar || tid === null || prov.length === 0) return [];
    const { punkter, ruta } = pilplatser(omrade);
    const ut: Vindpil[] = [];
    for (const p of punkter) {
      const i = narmaste(p, prov);
      const data = prognoser[punktNyckel(prov[i].lat, prov[i].lon)];
      const steg = stegVid(data?.prognos ?? null, tid);
      if (!steg || steg.franGrader === null || steg.medelvind === null) continue;
      const pil = byggPil(p, steg.franGrader, steg.medelvind, ruta);
      if (pil) ut.push(pil);
    }
    return ut;
  }, [visaPilar, tid, prov, prognoser, omrade]);

  const zon = useMemo(() => {
    if (!vindPa || !zonPa || !aktiv || !aktivPrognos || tid === null || !aktivSteg) return null;
    if (aktivSteg.franGrader === null || aktivSteg.medelvind === null) return null;
    return beraknaVittringszon(
      aktiv.pos,
      {
        franGrader: aktivSteg.franGrader,
        medelvind: aktivSteg.medelvind,
        byvind: aktivSteg.byvind,
      },
      {
        prognosTimmar: prognosTimmar(aktivPrognos, tid),
        riktningsskifte: riktningsskifte(aktivPrognos, tid),
      },
      {
        langd,
        bredd: BREDDVAL.find((b) => b.varde === bredd)?.faktor ?? 1,
      },
    );
  }, [vindPa, zonPa, aktiv, aktivPrognos, tid, aktivSteg, langd, bredd]);

  const onKartTryck = useCallback(
    (e: MapPressEvent) => {
      if (!vindPa) return;
      // Tryck på en markör ger också ett karttryck - det hanteras av markören.
      if ((e.nativeEvent as { action?: string }).action === "marker-press") return;
      setVald({ pos: e.nativeEvent.coordinate, namn: "Vald punkt på kartan" });
    },
    [vindPa],
  );

  const onValjPunkt = useCallback(
    (p: Kartpunkt) => {
      if (!vindPa) {
        setVindPa(true);
      }
      setVald({
        pos: { latitude: p.lat, longitude: p.lon },
        namn: `${kategoriNamn(p.typ)} ${p.namn}`.trim(),
        punktId: p.id,
      });
    },
    [vindPa],
  );

  const visaNamn = breddMeter < MAX_BREDD_FOR_NAMN;
  const allaPunkter = useMemo(() => kartdata.flatMap((k) => k.punkter), [kartdata]);

  const satellit = kartTyp === "hybrid";
  const toppPadding = insets.top + avstand.s3;

  return (
    <View style={[styles.fyll, { backgroundColor: farger.surface100 }]}>
      <MapView
        ref={karta}
        style={styles.fyll}
        initialRegion={SVERIGE}
        mapType={kartTyp}
        userInterfaceStyle={schema}
        showsUserLocation={behorighet === "ok"}
        onUserLocationChange={onPositionAndras}
        showsCompass
        showsScale
        showsPointsOfInterest={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        // Kompassen och skalan hamnar under positionsrutan.
        mapPadding={{ top: toppPadding + 64, right: 0, bottom: 0, left: 0 }}
        onRegionChangeComplete={setOmrade}
        onPress={onKartTryck}
      >
        {kartdata.map((k) => (
          <GransLager key={k.jaktmark.id} punkter={k.grans} />
        ))}
        {vindPa && zon && <ZonLager zon={zon} />}
        {visaPilar && <PilLager pilar={pilar} />}
        {allaPunkter.map((p) => {
          const namnSyns = visaNamn && arPass(p.typ);
          const arVald = vald?.punktId === p.id;
          return (
            <PunktMarkor
              key={`${p.id}-${namnSyns ? 1 : 0}-${arVald ? 1 : 0}`}
              punkt={p}
              visaNamn={namnSyns}
              vald={arVald}
              onValj={onValjPunkt}
            />
          );
        })}
        {vindPa && vald && <JagareMarkor position={vald.pos} />}
      </MapView>

      {/* Positionsruta överst */}
      <View
        style={[
          styles.ruta,
          {
            top: toppPadding,
            backgroundColor: farger.surface200,
            boxShadow: kortSkugga,
            borderColor: farger.border,
          },
        ]}
        accessibilityLiveRegion="polite"
      >
        {behorighet === "nekad" ? (
          <View style={styles.nekad}>
            <Txt variant="heading">Platsåtkomst saknas</Txt>
            <Txt farg="inkMuted">
              Tillåt plats för Skade i Inställningar för att se var du är på
              kartan. Positionen används bara i telefonen och sparas inte.
            </Txt>
            <Knapp
              titel="Öppna Inställningar"
              variant="sekundar"
              onPress={() => void Linking.openSettings()}
            />
          </View>
        ) : position ? (
          <View style={styles.rutaRad}>
            <View style={styles.flex1}>
              <Txt variant="bodyStrong" selectable style={styles.siffror}>
                {formateraKoordinat(position.latitude, "lat")}{" "}
                {formateraKoordinat(position.longitude, "lon")}
              </Txt>
              <Txt variant="caption" farg="inkMuted">
                {position.noggrannhet !== null
                  ? `Noggrannhet ±${Math.round(position.noggrannhet)} m`
                  : "Noggrannhet okänd"}
              </Txt>
            </View>
            {solHandelse && (
              <View
                style={[styles.sol, { backgroundColor: farger.surface300 }]}
                accessible
                accessibilityLabel={`${solHandelse.typ === "uppgang" ? "Soluppgång" : "Solnedgång"} ${formateraSoltid(solHandelse.tid, nu)}`}
              >
                <Ikon
                  namn={
                    solHandelse.typ === "uppgang" ? "soluppgang" : "solnedgang"
                  }
                  farg={farger.ink}
                />
                <View>
                  <Txt variant="bodyStrong" style={styles.siffror}>
                    {formateraKlocka(solHandelse.tid)}
                  </Txt>
                  {!!solDagEtikett(solHandelse.tid, nu) && (
                    <Txt variant="caption" farg="inkMuted">
                      {solDagEtikett(solHandelse.tid, nu)}
                    </Txt>
                  )}
                </View>
              </View>
            )}
          </View>
        ) : (
          <Txt farg="inkMuted">
            {behorighet === "laddar" ? "Kartan laddas…" : "Söker position…"}
          </Txt>
        )}
      </View>

      {/* Nere: knappar till höger, och prognospanelen när vinden är på. */}
      <View style={styles.nere} pointerEvents="box-none">
        {!(vindPa && panelOppen) && (
          <View style={styles.knappar} pointerEvents="box-none">
            <KartKnapp
              ikon="vind"
              text={vindPa ? "Dölj vind" : "Vind"}
              etikett={vindPa ? "Dölj vind och vittring" : "Visa vind och vittring"}
              onPress={() => setVindPa(!vindPa)}
            />
            <KartKnapp
              ikon="lager"
              text={satellit ? "Karta" : "Satellit"}
              etikett={satellit ? "Visa vanlig karta" : "Visa satellitbild"}
              onPress={() => setKartTyp(satellit ? "standard" : "hybrid")}
            />
            {vindPa && kartdata.length > 0 && (
              <KartKnapp
                ikon="jaktmark"
                text="Jaktmark"
                etikett="Visa hela jaktmarken"
                onPress={() => visaJaktmark(koppling.jaktmarkId)}
              />
            )}
            {behorighet === "ok" && (
              <KartKnapp
                ikon="position"
                text="Min position"
                etikett="Centrera på min position"
                onPress={minPosition}
                framhavd
              />
            )}
          </View>
        )}
        {vindPa && (
          <VindPanel
            oppen={panelOppen}
            setOppen={setPanelOppen}
            nu={nuSek}
            prognos={aktivPrognos}
            steg={aktivSteg}
            franMinne={aktivData?.franMinne ?? false}
            laddar={aktivData?.laddar ?? false}
            fel={aktivData?.fel ?? null}
            onForsokIgen={() => setForsok((f) => f + 1)}
            tider={tider}
            valdTid={tid}
            setValdTid={setValdTid}
            positionNamn={aktiv?.namn ?? null}
            kanAterstalla={!!vald && !!gpsPosition}
            onAterstall={() => {
              setVald(null);
              if (gpsPosition) centrera(gpsPosition.latitude, gpsPosition.longitude);
            }}
            zonPa={zonPa}
            setZonPa={setZonPa}
            langd={langd}
            setLangd={setLangd}
            bredd={bredd}
            setBredd={setBredd}
            zon={zon}
            maxHojd={Math.round(skarmHojd * 0.42)}
          />
        )}
        {vindPa && !visaPilar && (
          <View style={[styles.zoomaIn, { backgroundColor: farger.surface200 }]}>
            <Txt variant="caption">Zooma in för att se vindpilar.</Txt>
          </View>
        )}
      </View>
    </View>
  );
}

/** Pillknapp ovanpå kartan: ikon + ord, minst 56 px hög. */
function KartKnapp({
  ikon,
  text,
  etikett,
  onPress,
  framhavd = false,
}: {
  ikon: IkonNamn;
  text: string;
  etikett: string;
  onPress: () => void;
  framhavd?: boolean;
}) {
  const { farger, kortSkugga } = useTema();
  const bakgrund = framhavd ? farger.brand : farger.surface200;
  const forgrund = framhavd ? farger.onBrand : farger.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etikett}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.kartKnapp,
        {
          backgroundColor: bakgrund,
          boxShadow: kortSkugga,
          borderColor: farger.border,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <Ikon namn={ikon} farg={forgrund} />
      <Txt variant="button" style={{ color: forgrund }}>
        {text}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fyll: { flex: 1 },
  ruta: {
    position: "absolute",
    left: avstand.s4,
    right: avstand.s4,
    borderRadius: radie.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: avstand.s4,
    paddingVertical: avstand.s3,
  },
  nekad: { gap: avstand.s2 },
  rutaRad: { flexDirection: "row", alignItems: "center", gap: avstand.s3 },
  flex1: { flex: 1 },
  sol: {
    flexDirection: "row",
    alignItems: "center",
    gap: avstand.s1,
    paddingHorizontal: avstand.s3,
    paddingVertical: avstand.s2,
    borderRadius: radie.pill,
  },
  siffror: { fontVariant: ["tabular-nums"] },
  nere: {
    position: "absolute",
    left: avstand.s3,
    right: avstand.s3,
    bottom: avstand.s3,
    gap: avstand.s3,
  },
  knappar: {
    alignItems: "flex-end",
    gap: avstand.s3,
    paddingRight: avstand.s1,
  },
  zoomaIn: {
    alignSelf: "center",
    paddingHorizontal: avstand.s3,
    paddingVertical: avstand.s1,
    borderRadius: radie.pill,
  },
  kartKnapp: {
    minHeight: tryck.min,
    flexDirection: "row",
    alignItems: "center",
    gap: avstand.s2,
    paddingHorizontal: avstand.s4,
    borderRadius: radie.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
