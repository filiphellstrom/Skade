import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Animated, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTema } from "@/theme/TemaContext";
import { avstand, radie } from "@/theme/tokens";
import type { UnixTimestamp } from "@/db/types";
import { Rullhjul } from "@/components/Rullhjul";
import { Knapp } from "@/components/ui/Knapp";
import { Kort, Listrad } from "@/components/ui/Kort";
import { Txt } from "@/components/ui/Txt";

/**
 * Tids- och datumval med Apples egna rullhjul (UIDatePicker i hjulstil),
 * beslutat av Filip 2026-11-01: "Apples egna tidsväljare (hjul) överallt
 * som även vibrerar när man ändrar". Hjulen ger iPhones egen haptiska tick
 * för varje steg - samma känsla som i Klocka- och Kalender-apparna.
 *
 * Används för drevets start/slut (TidVal), hundens födelsedatum,
 * periodfiltrets Från/Till och dokumentens "Giltigt till".
 *
 * Webbversionen har ingen UIDatePicker. Där används appens egna hjul
 * (Rullhjul) i stället, så att webben fortfarande går att testa.
 */

const MANADER = [
  "januari", "februari", "mars", "april", "maj", "juni",
  "juli", "augusti", "september", "oktober", "november", "december",
];
const tt = (n: number) => String(n).padStart(2, "0");

export function klockslag(ts: UnixTimestamp): string {
  const d = new Date(ts * 1000);
  return `${tt(d.getHours())}:${tt(d.getMinutes())}`;
}

/** "14 mars 2029" */
export function datumText(ts: UnixTimestamp): string {
  const d = new Date(ts * 1000);
  return `${d.getDate()} ${MANADER[d.getMonth()]} ${d.getFullYear()}`;
}

/** Lokal midnatt för ett Date. */
export function midnatt(d: Date): UnixTimestamp {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return Math.floor(x.getTime() / 1000);
}

/** Ark som glider upp underifrån med titel, innehåll och Klar. */
export function HjulArk({
  oppen,
  titel,
  undertitel,
  onStang,
  children,
  stangTitel = "Klar",
}: {
  oppen: boolean;
  titel: string;
  undertitel?: string;
  onStang: () => void;
  children: ReactNode;
  /** Knappen längst ned, t.ex. "Avbryt" i ett val-ark. */
  stangTitel?: string;
}) {
  const { farger, schema } = useTema();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const [synlig, setSynlig] = useState(false);

  useEffect(() => {
    if (oppen) {
      setSynlig(true);
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    } else if (synlig) {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setSynlig(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oppen]);

  return (
    <Modal visible={synlig} transparent animationType="none" onRequestClose={onStang} statusBarTranslucent>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: schema === "dark" ? "rgba(0,0,0,0.55)" : "rgba(20,32,27,0.35)", opacity: anim },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onStang} accessibilityLabel="Stäng" accessibilityRole="button" />
      </Animated.View>
      <Animated.View
        style={[
          styles.ark,
          {
            backgroundColor: farger.surface200,
            paddingBottom: Math.max(insets.bottom, avstand.s4) + avstand.s2,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }],
          },
        ]}
        accessibilityViewIsModal
      >
        <View style={[styles.grepp, { backgroundColor: farger.border }]} />
        <View style={styles.rubrik}>
          <Txt variant="title2" accessibilityRole="header">
            {titel}
          </Txt>
          {!!undertitel && (
            <Txt variant="body" farg="inkMuted">
              {undertitel}
            </Txt>
          )}
        </View>
        {children}
        <Knapp titel={stangTitel} variant={stangTitel === "Klar" ? "primar" : "sekundar"} onPress={onStang} />
      </Animated.View>
    </Modal>
  );
}

const TIMMAR = Array.from({ length: 24 }, (_, i) => i);
const MINUTER = Array.from({ length: 60 }, (_, i) => i);
const DAGAR = Array.from({ length: 31 }, (_, i) => i + 1);
const MANADSINDEX = Array.from({ length: 12 }, (_, i) => i);

/**
 * Själva hjulen. `lage` "tid" ändrar bara klockslaget (datumet i `varde`
 * behålls), "datum" ändrar bara datumet (lokal midnatt).
 */
export function AppleHjul({
  lage,
  varde,
  onChange,
  min,
  max,
  etikett,
}: {
  lage: "tid" | "datum";
  varde: UnixTimestamp;
  onChange: (ts: UnixTimestamp) => void;
  min?: UnixTimestamp;
  max?: UnixTimestamp;
  etikett: string;
}) {
  const { farger, schema } = useTema();
  const d = new Date(varde * 1000);

  if (Platform.OS !== "web") {
    return (
      <View style={styles.native}>
        <DateTimePicker
          value={d}
          mode={lage === "tid" ? "time" : "date"}
          display="spinner"
          locale="sv-SE"
          is24Hour
          themeVariant={schema}
          textColor={farger.ink}
          minimumDate={min !== undefined ? new Date(min * 1000) : undefined}
          maximumDate={max !== undefined ? new Date(max * 1000) : undefined}
          accessibilityLabel={etikett}
          onChange={(_e, ny) => {
            if (!ny) {
              return;
            }
            if (lage === "tid") {
              const r = new Date(varde * 1000);
              r.setHours(ny.getHours(), ny.getMinutes(), 0, 0);
              onChange(Math.floor(r.getTime() / 1000));
            } else {
              onChange(midnatt(ny));
            }
          }}
          style={styles.nativeHjul}
        />
      </View>
    );
  }

  // Webben: appens egna hjul.
  if (lage === "tid") {
    const satt = (h: number, m: number) => {
      const r = new Date(varde * 1000);
      r.setHours(h, m, 0, 0);
      onChange(Math.floor(r.getTime() / 1000));
    };
    return (
      <View style={styles.webbHjul}>
        <Rullhjul etikett={`${etikett}, timme`} varden={TIMMAR} valt={d.getHours()} format={tt} onChange={(h) => satt(h, d.getMinutes())} />
        <Txt variant="title2">:</Txt>
        <Rullhjul etikett={`${etikett}, minut`} varden={MINUTER} valt={d.getMinutes()} format={tt} onChange={(m) => satt(d.getHours(), m)} />
      </View>
    );
  }
  const nuAr = new Date().getFullYear();
  const minAr = min !== undefined ? new Date(min * 1000).getFullYear() : nuAr - 30;
  const maxAr = max !== undefined ? new Date(max * 1000).getFullYear() : nuAr + 15;
  const AR = Array.from({ length: maxAr - minAr + 1 }, (_, i) => minAr + i);
  const satt = (dag: number, man: number, ar: number) => {
    const sista = new Date(ar, man + 1, 0).getDate();
    let ts = midnatt(new Date(ar, man, Math.min(dag, sista)));
    if (min !== undefined) ts = Math.max(ts, min);
    if (max !== undefined) ts = Math.min(ts, max);
    onChange(ts);
  };
  return (
    <View style={styles.webbHjul}>
      <Rullhjul etikett={`${etikett}, dag`} varden={DAGAR} valt={d.getDate()} format={String} onChange={(v) => satt(v, d.getMonth(), d.getFullYear())} />
      <Rullhjul etikett={`${etikett}, månad`} varden={MANADSINDEX} valt={d.getMonth()} format={(m) => MANADER[m].slice(0, 3)} onChange={(v) => satt(d.getDate(), v, d.getFullYear())} />
      <Rullhjul etikett={`${etikett}, år`} varden={AR} valt={d.getFullYear()} format={String} onChange={(v) => satt(d.getDate(), d.getMonth(), v)} />
    </View>
  );
}

/**
 * En rad som visar ett datum. Tryck för att öppna hjulen i ett ark.
 * Används fristående (i ett eget kort) eller inuti ett listkort
 * (`iKort` + `forsta`).
 */
export function DatumRad({
  titel,
  varde,
  onChange,
  min,
  max,
  iKort = false,
  forsta = true,
  arkTitel,
}: {
  titel: string;
  varde: UnixTimestamp;
  onChange: (ts: UnixTimestamp) => void;
  min?: UnixTimestamp;
  max?: UnixTimestamp;
  iKort?: boolean;
  forsta?: boolean;
  arkTitel?: string;
}) {
  const [oppen, setOppen] = useState(false);
  const rad = (
    <Listrad
      forsta={forsta}
      titel={titel}
      hoger={datumText(varde)}
      hojd={64}
      accessibilityLabel={`${titel} ${datumText(varde)}, ändra`}
      onPress={() => setOppen(true)}
    />
  );
  return (
    <>
      {iKort ? rad : <Kort lista>{rad}</Kort>}
      <HjulArk oppen={oppen} titel={arkTitel ?? titel} onStang={() => setOppen(false)}>
        <AppleHjul lage="datum" varde={varde} onChange={onChange} min={min} max={max} etikett={arkTitel ?? titel} />
      </HjulArk>
    </>
  );
}

const styles = StyleSheet.create({
  ark: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radie.lg,
    borderTopRightRadius: radie.lg,
    paddingTop: avstand.s2,
    paddingHorizontal: avstand.s4,
    gap: avstand.s3,
  },
  grepp: { alignSelf: "center", width: 36, height: 5, borderRadius: 3 },
  rubrik: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  native: { alignItems: "center" },
  nativeHjul: { height: 216, alignSelf: "stretch" },
  webbHjul: { flexDirection: "row", alignItems: "center", gap: avstand.s1, paddingHorizontal: avstand.s4 },
});
