import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getDatabase } from "@/db/client";
import { hamtaKartdata } from "@/db/queries/kartpunkt";
import type { Kartdata } from "@/db/queries/kartpunkt";
import { hamtaPagaendeJaktdag } from "@/db/queries/jaktdag";
import { useProfil } from "@/contexts/ProfilContext";
import { Ikon } from "@/components/ui/Ikon";
import type { IkonNamn } from "@/components/ui/Ikon";
import { Txt } from "@/components/ui/Txt";
import { useTema } from "@/theme/TemaContext";
import { avstand, FONT, KART_FARGER, radie, tryck } from "@/theme/tokens";
import { formateraKoordinat } from "@/utils/koordinat";
import {
  formateraKlocka,
  formateraSoltid,
  nastaSolhandelse,
  solDagEtikett,
} from "@/utils/sol";
import { arPass, kategoriNamn } from "@/vind/gpx";
import { useJag } from "@/jaktlag/jag";
import { eftersokLage } from "@/jaktlag/format";
import { laddaFranMinne, synka, useAktivPlan, useAktivaEftersok, valjAktivPlan } from "@/jaktlag/lager";
import { mittUppdrag } from "@/jaktlag/typer";
import { laggInKartstilar, laggPaKartlager, planGranser, ritaPlan } from "./planLeaflet";
import type { Kartlagerval } from "./planLeaflet";
import { punktFarg } from "./punktfarg";

export { formateraKoordinat };

/**
 * Kartfliken på webben (2026-11-11): Leaflet med öppna kartbilder.
 * Grunden för jaktplaneraren, som görs bäst på en stor skärm.
 *
 * - Två kartlager: Karta (OpenStreetMap) och Terräng (OpenTopoMap, med
 *   höjdkurvor). Båda är fria att använda med källhänvisning, och båda
 *   skickar CORS-huvuden – nödvändigt eftersom sidan körs med
 *   Cross-Origin-Embedder-Policy (public/_headers, för SQLite). Därför
 *   crossOrigin på lagren. Lantmäteriets terrängkarta och flygfoto kräver
 *   ett konto och är en öppen fråga.
 * - Jaktmarkernas gräns och markeringar (importerade från GPX under
 *   Jaktmarker) visas som i appen. Namn på pass och torn syns inzoomat.
 * - Egen position från webbläsaren, om man tillåter det. Sparas inte.
 * - Den aktiva jaktplanen (vald med "Visa på kartan" i en plan) ritas med
 *   det egna uppdraget fullt ut och de andras som små släpplatser.
 *   Öppna eftersök i jaktlagen visas som röda punkter, tagna som gula.
 *   ?punkt=lat,lon pekar ut en plats (t.ex. ett eftersök).
 * - Vind och vittring finns ännu bara i appen.
 *
 * Kartbilderna ritas av Leaflet direkt i en div; rutan och knapparna
 * ovanpå är vanliga komponenter. Namn från GPX-filer sätts som ren text
 * (textContent), aldrig som HTML.
 */

type Lager = Kartlagerval;

/** Hela Sverige, innan något annat är känt. */
const SVERIGE: L.LatLngExpression = [62.5, 16.5];
/** Namn på pass och torn visas från den här zoomnivån. */
const ZOOM_FOR_NAMN = 15;
const POSITION_FARG = "#0a84ff";

type PlatsLage = "vantar" | "ok" | "nekad" | "saknas";

interface Position {
  latitude: number;
  longitude: number;
  noggrannhet: number | null;
}

function tillGranser(data: Kartdata): L.LatLngBounds | null {
  const punkter: L.LatLngTuple[] = [
    ...data.grans.map((p): L.LatLngTuple => [p.latitude, p.longitude]),
    ...data.punkter.map((p): L.LatLngTuple => [p.lat, p.lon]),
  ];
  return punkter.length > 0 ? L.latLngBounds(punkter) : null;
}

export function KartaVy() {
  const { farger, kortSkugga } = useTema();
  const { profil } = useProfil();
  const {
    jaktmark: jaktmarkParam,
    plan: planParam,
    punkt: punktParam,
    punktNamn,
  } = useLocalSearchParams<{ jaktmark?: string; plan?: string; punkt?: string; punktNamn?: string }>();
  const { jag } = useJag();
  const aktivPlan = useAktivPlan();
  const eftersok = useAktivaEftersok();
  const [allaRutter, setAllaRutter] = useState(false);

  const behallare = useRef<HTMLDivElement>(null);
  const karta = useRef<L.Map | null>(null);
  const kartlager = useRef<L.TileLayer | null>(null);
  const datalager = useRef<L.LayerGroup | null>(null);
  const positionslager = useRef<L.LayerGroup | null>(null);
  const planlager = useRef<L.LayerGroup | null>(null);
  const eftersokslager = useRef<L.LayerGroup | null>(null);
  const harPassat = useRef<string | null>(null);
  const harCentreratPaPosition = useRef(false);

  const [lager, setLager] = useState<Lager>("karta");
  const [kartdata, setKartdata] = useState<Kartdata[] | null>(null);
  const [pagaendeMark, setPagaendeMark] = useState<string | null>(null);
  const [plats, setPlats] = useState<PlatsLage>("vantar");
  const [position, setPosition] = useState<Position | null>(null);
  const [nu, setNu] = useState(() => new Date());

  // Kartan skapas en gång och tas bort när fliken lämnas för gott.
  useEffect(() => {
    if (!behallare.current) return;
    laggInKartstilar(FONT[400]);
    const k = L.map(behallare.current, { zoomControl: false }).setView(SVERIGE, 5);
    L.control.zoom({ position: "bottomleft", zoomInTitle: "Zooma in", zoomOutTitle: "Zooma ut" }).addTo(k);
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(k);
    k.attributionControl.setPrefix(false);
    datalager.current = L.layerGroup().addTo(k);
    planlager.current = L.layerGroup().addTo(k);
    eftersokslager.current = L.layerGroup().addTo(k);
    positionslager.current = L.layerGroup().addTo(k);
    const visaNamn = () => behallare.current?.classList.toggle("visa-namn", k.getZoom() >= ZOOM_FOR_NAMN);
    k.on("zoomend", visaNamn);
    karta.current = k;
    // Behållaren får sin storlek först när sidan är utlagd.
    const storlek = new ResizeObserver(() => k.invalidateSize());
    storlek.observe(behallare.current);
    return () => {
      storlek.disconnect();
      k.remove();
      karta.current = null;
      kartlager.current = null;
    };
  }, []);

  // Kartlager: byt bild när valet ändras.
  useEffect(() => {
    const k = karta.current;
    if (!k) return;
    kartlager.current?.remove();
    kartlager.current = laggPaKartlager(k, lager);
  }, [lager]);

  // Kartdata och pågående jaktdag hämtas varje gång fliken visas.
  useFocusEffect(
    useCallback(() => {
      let avbruten = false;
      (async () => {
        const db = await getDatabase();
        const data = await hamtaKartdata(db, profil.id);
        const pagaende = await hamtaPagaendeJaktdag(db, profil.id);
        if (avbruten) return;
        setKartdata(data);
        setPagaendeMark(pagaende?.jaktmarkId ?? null);
      })().catch(() => {
        if (!avbruten) setKartdata([]);
      });
      // Storleken kan ha ändrats medan fliken var dold.
      karta.current?.invalidateSize();
      return () => {
        avbruten = true;
      };
    }, [profil.id]),
  );

  // Rita gränser och markeringar.
  useEffect(() => {
    const grupp = datalager.current;
    if (!grupp || !kartdata) return;
    grupp.clearLayers();
    for (const data of kartdata) {
      if (data.grans.length >= 3) {
        L.polygon(
          data.grans.map((p): L.LatLngTuple => [p.latitude, p.longitude]),
          { color: KART_FARGER.grans, weight: 3, fillColor: KART_FARGER.grans, fillOpacity: 0.04, interactive: false },
        ).addTo(grupp);
      }
      for (const p of data.punkter) {
        const pass = arPass(p.typ);
        const markor = L.circleMarker([p.lat, p.lon], {
          radius: pass ? 8 : 6,
          color: KART_FARGER.etikettYta,
          weight: 2,
          fillColor: punktFarg(p.typ),
          fillOpacity: 1,
        });
        const ruta = document.createElement("div");
        const rubrik = document.createElement("strong");
        rubrik.textContent = p.namn || kategoriNamn(p.typ);
        ruta.appendChild(rubrik);
        if (p.namn) {
          const rad = document.createElement("div");
          rad.textContent = kategoriNamn(p.typ);
          ruta.appendChild(rad);
        }
        const rad2 = document.createElement("div");
        rad2.textContent = `${formateraKoordinat(p.lat, "lat")} ${formateraKoordinat(p.lon, "lon")}`;
        ruta.appendChild(rad2);
        markor.bindPopup(ruta);
        if (pass && p.namn) {
          const etikett = document.createElement("span");
          etikett.textContent = p.namn;
          markor.bindTooltip(etikett, {
            permanent: true,
            direction: "right",
            offset: [8, 0],
            className: "skade-etikett",
          });
        }
        markor.addTo(grupp);
      }
    }
  }, [kartdata]);

  // Jaktlagens data: läs in det sparade, och håll den aktiva planens lag uppdaterat.
  const aktivtLagId = aktivPlan?.lagId;
  useFocusEffect(
    useCallback(() => {
      laddaFranMinne();
      if (!aktivtLagId) return;
      const kor = () => void synka(aktivtLagId).catch(() => {});
      kor();
      const timer = setInterval(kor, 15000);
      return () => clearInterval(timer);
    }, [aktivtLagId]),
  );

  // Den aktiva jaktplanen: mitt uppdrag fullt ut, de andras som små släpplatser.
  const planInnehall = aktivPlan?.plan.innehall;
  const mittId = aktivPlan ? (mittUppdrag(aktivPlan.plan, jag?.id ?? null, jag?.namn ?? null)?.id ?? null) : null;
  useEffect(() => {
    const grupp = planlager.current;
    if (!grupp) return;
    if (!planInnehall) {
      grupp.clearLayers();
      return;
    }
    ritaPlan(grupp, planInnehall, { fokusId: mittId, visaAllaRutter: allaRutter || mittId === null });
  }, [planInnehall, mittId, allaRutter]);

  const visaPlan = useCallback(() => {
    const granser = planInnehall ? planGranser(planInnehall) : null;
    if (granser && karta.current) {
      karta.current.fitBounds(granser, { padding: [40, 40], maxZoom: 16 });
      return true;
    }
    return false;
  }, [planInnehall]);

  // Öppna eftersök, och en utpekad punkt ("Visa på kartan").
  const utpekad = useMemo(() => {
    const [lat, lon] = (punktParam ?? "").split(",").map(Number);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  }, [punktParam]);
  useEffect(() => {
    const grupp = eftersokslager.current;
    if (!grupp) return;
    grupp.clearLayers();
    for (const e of eftersok) {
      const m = L.circleMarker([e.lat, e.lon], {
        radius: 10,
        color: "#ffffff",
        weight: 3,
        fillColor: e.status === "oppet" ? "#c0392b" : "#c98a00",
        fillOpacity: 1,
      });
      const ruta = document.createElement("div");
      const rubrik = document.createElement("strong");
      rubrik.textContent = e.viltart ? `Eftersök: ${e.viltart.toLowerCase()}` : "Eftersök";
      const rad = document.createElement("div");
      rad.textContent = eftersokLage(e);
      ruta.append(rubrik, rad);
      m.bindPopup(ruta);
      const etikett = document.createElement("span");
      etikett.textContent = "Eftersök";
      m.bindTooltip(etikett, { permanent: true, direction: "top", offset: [0, -10], className: "skade-etikett skade-etikett-alltid" });
      m.addTo(grupp);
    }
    if (utpekad && !eftersok.some((e) => e.lat === utpekad.lat && e.lon === utpekad.lon)) {
      const m = L.circleMarker([utpekad.lat, utpekad.lon], { radius: 9, color: "#ffffff", weight: 3, fillColor: "#14201b", fillOpacity: 1 });
      const etikett = document.createElement("span");
      etikett.textContent = punktNamn || "Vald punkt";
      m.bindTooltip(etikett, { permanent: true, direction: "top", offset: [0, -10], className: "skade-etikett skade-etikett-alltid" });
      m.addTo(grupp);
    }
  }, [eftersok, utpekad, punktNamn]);

  const visaJaktmark = useCallback(
    (id?: string | null) => {
      const data = kartdata?.find((k) => k.jaktmark.id === id) ?? kartdata?.[0];
      const granser = data ? tillGranser(data) : null;
      if (granser && karta.current) {
        karta.current.fitBounds(granser, { padding: [40, 40], maxZoom: 16 });
        return true;
      }
      return false;
    },
    [kartdata],
  );

  // Första gången kartdata finns (eller när "Visa på kartan" pekar ut en mark): zooma dit.
  useEffect(() => {
    // En utpekad punkt går först, sedan planen ("Visa på kartan" från en plan), sedan jaktmarken.
    if (utpekad) {
      const nyckel = `punkt:${punktParam}`;
      if (harPassat.current !== nyckel && karta.current) {
        karta.current.setView([utpekad.lat, utpekad.lon], 15);
        harPassat.current = nyckel;
      }
      return;
    }
    if (planParam && planInnehall) {
      const nyckel = `plan:${aktivPlan?.plan.id}`;
      if (harPassat.current !== nyckel && visaPlan()) harPassat.current = nyckel;
      return;
    }
    if (!kartdata || kartdata.length === 0) {
      if (kartdata && planInnehall && harPassat.current === null && visaPlan()) harPassat.current = "start";
      return;
    }
    const mal = jaktmarkParam ?? pagaendeMark ?? kartdata[0].jaktmark.id;
    const nyckel = jaktmarkParam ? `param:${jaktmarkParam}` : "start";
    if (harPassat.current === nyckel) return;
    if (visaJaktmark(mal)) harPassat.current = nyckel;
  }, [kartdata, jaktmarkParam, pagaendeMark, visaJaktmark, utpekad, punktParam, planParam, planInnehall, aktivPlan?.plan.id, visaPlan]);

  // Egen position från webbläsaren.
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setPlats("saknas");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setPlats("ok");
        setPosition({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          noggrannhet: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null,
        });
      },
      (fel) => setPlats(fel.code === fel.PERMISSION_DENIED ? "nekad" : "saknas"),
      { enableHighAccuracy: true, maximumAge: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Rita positionen. Utan kartdata centreras kartan på den första positionen.
  useEffect(() => {
    const grupp = positionslager.current;
    if (!grupp) return;
    grupp.clearLayers();
    if (!position) return;
    const punkt: L.LatLngTuple = [position.latitude, position.longitude];
    if (position.noggrannhet !== null) {
      L.circle(punkt, {
        radius: position.noggrannhet,
        color: POSITION_FARG,
        weight: 1,
        fillColor: POSITION_FARG,
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(grupp);
    }
    L.circleMarker(punkt, {
      radius: 7,
      color: "#ffffff",
      weight: 3,
      fillColor: POSITION_FARG,
      fillOpacity: 1,
      interactive: false,
    }).addTo(grupp);
    if (!harCentreratPaPosition.current && kartdata && kartdata.length === 0) {
      harCentreratPaPosition.current = true;
      karta.current?.setView(punkt, 14);
    }
  }, [position, kartdata]);

  useEffect(() => {
    const id = setInterval(() => setNu(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const solLat = position ? Math.round(position.latitude * 100) / 100 : null;
  const solLon = position ? Math.round(position.longitude * 100) / 100 : null;
  const solHandelse = useMemo(
    () => (solLat !== null && solLon !== null ? nastaSolhandelse(nu, solLat, solLon) : null),
    [nu, solLat, solLon],
  );

  const minPosition = () => {
    if (position) karta.current?.setView([position.latitude, position.longitude], 15);
  };

  const harKartdata = !!kartdata && kartdata.length > 0;

  return (
    <View style={styles.fyll}>
      <div ref={behallare} className="skade-karta" style={kartStil} />

      <View
        style={[styles.ruta, { backgroundColor: farger.surface200, borderColor: farger.border, boxShadow: kortSkugga }]}
        accessibilityLiveRegion="polite"
      >
        {position ? (
          <View style={styles.rutaRad}>
            <View style={styles.flex1}>
              <Txt variant="bodyStrong" selectable style={styles.siffror}>
                {formateraKoordinat(position.latitude, "lat")} {formateraKoordinat(position.longitude, "lon")}
              </Txt>
              <Txt variant="caption" farg="inkMuted">
                {position.noggrannhet !== null
                  ? `Din position, noggrannhet ±${Math.round(position.noggrannhet)} m`
                  : "Din position, noggrannhet okänd"}
              </Txt>
            </View>
            {solHandelse && (
              <View
                style={[styles.sol, { backgroundColor: farger.surface300 }]}
                accessible
                accessibilityLabel={`${solHandelse.typ === "uppgang" ? "Soluppgång" : "Solnedgång"} ${formateraSoltid(solHandelse.tid, nu)}`}
              >
                <Ikon namn={solHandelse.typ === "uppgang" ? "soluppgang" : "solnedgang"} farg={farger.ink} />
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
            {plats === "nekad"
              ? "Platsåtkomst är avstängd för sidan. Slå på den i webbläsaren om du vill se din position."
              : plats === "saknas"
                ? "Din position är inte tillgänglig just nu."
                : "Söker position…"}
          </Txt>
        )}
        {kartdata && !harKartdata && !aktivPlan && (
          <Txt variant="caption" farg="inkMuted" style={styles.tips}>
            Importera jaktmarkens gräns och pass från en GPX-fil under Jaktmarker, så visas de här.
          </Txt>
        )}
        {aktivPlan && (
          <View style={[styles.planrad, { borderTopColor: farger.border }]}>
            <View style={styles.flex1}>
              <Txt variant="bodyStrong" numberOfLines={1}>
                {aktivPlan.plan.namn}
              </Txt>
              <Txt variant="caption" farg="inkMuted" numberOfLines={1}>
                {mittId ? "Ditt uppdrag visas fullt ut" : "Jaktplan"} · {aktivPlan.data.lag.namn}
              </Txt>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Visa hela jaktplanen" onPress={visaPlan} hitSlop={8}>
              <Txt variant="button" farg="brand">
                Visa
              </Txt>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Ta bort planen från kartan" onPress={() => valjAktivPlan(null)} hitSlop={8}>
              <Txt variant="button" farg="inkMuted">
                Dölj
              </Txt>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.knappar} pointerEvents="box-none">
        {aktivPlan && mittId && (
          <KartKnapp
            ikon="hund"
            text={allaRutter ? "Bara min rutt" : "Allas rutter"}
            etikett={allaRutter ? "Visa bara min rutt" : "Visa allas rutter"}
            onPress={() => setAllaRutter(!allaRutter)}
          />
        )}
        <KartKnapp
          ikon="lager"
          text={lager === "karta" ? "Terräng" : "Karta"}
          etikett={lager === "karta" ? "Visa terrängkarta med höjdkurvor" : "Visa vanlig karta"}
          onPress={() => setLager(lager === "karta" ? "terrang" : "karta")}
        />
        {harKartdata && (
          <KartKnapp
            ikon="jaktmark"
            text="Jaktmark"
            etikett="Visa hela jaktmarken"
            onPress={() => visaJaktmark(jaktmarkParam ?? pagaendeMark)}
          />
        )}
        {position && (
          <KartKnapp
            ikon="position"
            text="Min position"
            etikett="Centrera på min position"
            onPress={minPosition}
            framhavd
          />
        )}
      </View>
    </View>
  );
}

/** Pillknapp ovanpå kartan, som i appen: ikon + ord, minst 56 px hög. */
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
  const forgrund = framhavd ? farger.onBrand : farger.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etikett}
      onPress={onPress}
      style={({ pressed }) => [
        styles.kartKnapp,
        {
          backgroundColor: framhavd ? farger.brand : farger.surface200,
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

/** zIndex 0 håller Leaflets egna lager under rutan och knapparna. */
const kartStil = { position: "absolute", inset: 0, zIndex: 0 } as const;

const styles = StyleSheet.create({
  fyll: { flex: 1 },
  ruta: {
    position: "absolute",
    top: avstand.s3,
    left: avstand.s4,
    right: avstand.s4,
    maxWidth: 520,
    zIndex: 1,
    borderRadius: radie.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: avstand.s4,
    paddingVertical: avstand.s3,
  },
  rutaRad: { flexDirection: "row", alignItems: "center", gap: avstand.s3 },
  flex1: { flex: 1 },
  tips: { marginTop: avstand.s1 },
  sol: {
    flexDirection: "row",
    alignItems: "center",
    gap: avstand.s1,
    paddingHorizontal: avstand.s3,
    paddingVertical: avstand.s2,
    borderRadius: radie.pill,
  },
  siffror: { fontVariant: ["tabular-nums"] },
  planrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: avstand.s4,
    marginTop: avstand.s2,
    paddingTop: avstand.s2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  knappar: {
    position: "absolute",
    right: avstand.s4,
    bottom: avstand.s6,
    zIndex: 1,
    alignItems: "flex-end",
    gap: avstand.s3,
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
