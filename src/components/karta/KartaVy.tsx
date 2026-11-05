import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Linking, Pressable, StyleSheet, View } from "react-native";
import MapView from "react-native-maps";
import type {
  MapType,
  Region,
  UserLocationChangeEvent,
} from "react-native-maps";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
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
 */

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
      />

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

      {/* Knappar nere till höger */}
      <View style={styles.knappar}>
        <KartKnapp
          ikon="lager"
          text={satellit ? "Karta" : "Satellit"}
          etikett={satellit ? "Visa vanlig karta" : "Visa satellitbild"}
          onPress={() => setKartTyp(satellit ? "standard" : "hybrid")}
        />
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
  knappar: {
    position: "absolute",
    right: avstand.s4,
    bottom: avstand.s4,
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
